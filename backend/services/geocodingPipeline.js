const axios = require('axios');
const mongoose = require('mongoose');
const BeneficiaryDataset = require('../models/BeneficiaryDataset');
const Beneficiary = require('../models/Beneficiary');
const GeocodingCache = require('../models/GeocodingCache');
const { resolveZoneAssignment } = require('./zoneIntersection');

// STRATEGIC: Geocoding Cost & Rate Control
const GEOCODING_GUARDS = {
  batchSize: 50,
  delayBetweenBatchesMs: 1100, // ~50 QPS
  lowConfidenceThreshold: 0.6
};

/**
 * STRATEGIC: India-specific address normalization
 * Handles common Indian address quirks to improve geocoding hits.
 */
const normalizeIndianAddress = (raw) => {
  if (!raw) return '';
  let addr = raw.trim();

  // Remove common noise phrases that confuse Google Maps
  addr = addr.replace(/^(near|opp|opposite|behind|beside|adjacent to|in front of)\s+/i, '');

  // Expand common abbreviations (simplified for first pass)
  const abbrMap = {
    'nagar': 'Nagar', 'marg': 'Marg', 'rd': 'Road', 'st': 'Street'
  };
  Object.keys(abbrMap).forEach(key => {
    const reg = new RegExp(`\\b${key}\\b`, 'gi');
    addr = addr.replace(reg, abbrMap[key]);
  });

  // Append country context if missing
  if (!/india$/i.test(addr)) addr += ', India';

  return addr;
};

/**
 * STRATEGIC: Confidence Scoring Logic
 * Translates Google location metadata into a 0-1 reliability score.
 */
const computeConfidence = (result) => {
  const typeMap = {
    'ROOFTOP': 0.95,
    'RANGE_INTERPOLATED': 0.75,
    'GEOMETRIC_CENTER': 0.55,
    'APPROXIMATE': 0.35
  };

  let score = typeMap[result.geometry.location_type] || 0.3;

  // Penalize for vague results (just a state or country)
  const vagueTypes = ['country', 'administrative_area_level_1', 'administrative_area_level_2'];
  if (result.types.some(t => vagueTypes.includes(t))) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
};

/**
 * Main Pipeline Orchestrator
 */
const runGeocodingPipeline = async (datasetId, zones = [], projectId = null, zoneIndex = null) => {
  const datasetObjectId = new mongoose.Types.ObjectId(datasetId);
  // 1. ATOMIC LOCK WITH HEARTBEAT (Prevents forever-locks on crash)
  const lockExpiry = new Date(Date.now() - 30 * 60000); // 30m Heartbeat
  
  const result = await BeneficiaryDataset.collection.findOneAndUpdate(
    { 
      _id: datasetObjectId, 
      $or: [
        { 'processingStats.status': { $ne: 'processing' } },
        { 'processingStats.startTime': { $lt: lockExpiry } } 
      ]
    },
    { 
      $set: { 
        'processingStats.status': 'processing', 
        'processingStats.startTime': new Date(),
        'processingStats.processedCount': 0,
        'processingStats.failedCount': 0,
        'processingStats.geocodedCount': 0
      } 
    },
    { returnDocument: 'after' }
  );

  // DRIVER COMPATIBILITY: Handle both { value: doc } and direct doc return
  const lockDoc = result?.value || result;

  if (!lockDoc || lockDoc._id?.toString() !== datasetObjectId.toString()) {
    console.warn(`[PIPELINE] Aborting: Dataset ${datasetId} is already being processed or lock failed.`);
    return;
  }

  const projectObjectId = projectId ? new mongoose.Types.ObjectId(projectId) : null;
  const records = await Beneficiary.find({ datasetId: datasetObjectId });
  const total = records.length;
  const startTime = Date.now();
  let geocodedCount = 0;
  let failedCount = 0;

  // STRATEGIC: Mark the project zone as 'processing' immediately to provide dashboard feedback
  if (projectObjectId && zoneIndex !== null && zoneIndex !== undefined) {
    const Project = require('../models/Project');
    const zIdx = Number(zoneIndex);
    await Project.findByIdAndUpdate(projectObjectId, {
      $set: { [`beneficiarySummary.zoneStats.${zIdx}.status`]: 'processing' }
    });
  }

  if (total === 0) {
    console.warn(`[PIPELINE] No records found for Dataset ${datasetId}. Finalizing...`);
    await BeneficiaryDataset.collection.updateOne(
      { _id: datasetObjectId },
      { $set: { 'processingStats.status': 'complete' } }
    );
    return;
  }

  let processed = 0;
  console.log(`[PIPELINE] Starting Engine for Dataset: ${datasetId} (${total} records)`);
  
  // STRATEGIC: Force-Link Project ID immediately for Zero-Wait Visibility
  if (projectObjectId) {
    console.log(`[PIPELINE] Performing Early Mission Anchorage for Project: ${projectObjectId}`);
    await Beneficiary.updateMany(
      { datasetId: datasetObjectId },
      { $set: { projectId: projectObjectId } }
    );
  }

  // WARM-UP: Brief pause to allow frontend to stabilize polling
  await new Promise(r => setTimeout(r, 1000));

  // ─── CONCURRENT BATCH PROCESSING ───
  // Using sub-batches of 10 to balance speed vs API rate limits
  const subBatchSize = 10;
  
    for (let i = 0; i < records.length; i += subBatchSize) {
      const subBatch = records.slice(i, i + subBatchSize);
      console.log(`[PIPELINE] Starting Sub-Batch ${i/subBatchSize + 1}/${Math.ceil(total/subBatchSize)}...`);
      
      await Promise.all(subBatch.map(async (record) => {
        let geoResult = null;
        try {
          console.log(`[PIPELINE] Row ${record.rowIndex}: Normalizing address...`);
          const normalized = normalizeIndianAddress(record.rawLocation);
          
          if (record.geo?.lat && record.geo?.lng) {
            console.log(`[PIPELINE] Row ${record.rowIndex}: Using Direct GPS.`);
            geoResult = { ...record.geo.toObject(), geocodeMethod: 'direct_coordinates', confidenceScore: 1.0 };
          } else if (normalized) {
            console.log(`[PIPELINE] Row ${record.rowIndex}: Checking Cache [${normalized}]...`);
            const cached = await GeocodingCache.findOne({ normalizedAddress: normalized }).maxTimeMS(2000);
            
            if (cached) {
              console.log(`[PIPELINE] Row ${record.rowIndex}: Cache HIT.`);
              geoResult = { lat: cached.lat, lng: cached.lng, formattedAddress: cached.formattedAddress, placeId: cached.placeId, confidenceScore: cached.confidenceScore, geocodeMethod: 'geocoded' };
            } else {
              console.log(`[PIPELINE] Row ${record.rowIndex}: Calling Google API...`);
              const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
                params: { address: normalized, key: process.env.GOOGLE_MAPS_API_KEY, region: 'in', language: 'en' },
                timeout: 5000 
              });

              if (response.data.status === 'OK') {
                console.log(`[PIPELINE] Row ${record.rowIndex}: API Success.`);
                const result = response.data.results[0];
                geoResult = { lat: result.geometry.location.lat, lng: result.geometry.location.lng, formattedAddress: result.formatted_address, placeId: result.place_id, confidenceScore: computeConfidence(result), geocodeMethod: 'geocoded' };
                await GeocodingCache.findOneAndUpdate({ normalizedAddress: normalized }, { $set: { ...geoResult, cachedAt: new Date() } }, { upsert: true });
              } else {
                console.log(`[PIPELINE] Row ${record.rowIndex}: API No Results.`);
                geoResult = { geocodeMethod: 'unresolved' };
              }
            }
          }

          let zoneAssignment = { status: 'geocode_failed' };
          if (geoResult?.lat) {
            zoneAssignment = resolveZoneAssignment(geoResult.lat, geoResult.lng, zones);
          }

          if (!geoResult?.lat) {
            console.log(`[PIPELINE] Row ${record.rowIndex}: Geocoding failed for "${record.rawLocation}". Triggering Zonal Fallback...`);
            const Project = require('../models/Project');
            const project = await Project.findById(projectObjectId);
            const zoneName = project?.regions?.[zoneIndex]?.name || 'Mission Area';
            
            const fallbackRes = await require('./geocodingService').geocodeAddress(zoneName);
            if (fallbackRes?.lat) {
              geoResult = { ...fallbackRes, geocodeMethod: 'zonal_fallback', confidenceScore: 0.3 };
            } else {
              geoResult = { geocodeMethod: 'unresolved' };
            }
          }

          console.log(`[PIPELINE] Row ${record.rowIndex}: Saving to DB...`);
          await Beneficiary.collection.updateOne(
            { _id: record._id },
            { $set: { geo: geoResult, zoneAssignment, 'geo.geocodedAt': new Date(), ...(projectObjectId && { projectId: projectObjectId }) } }
          );
        } catch (err) {
          console.error(`[PIPELINE] Row ${record.rowIndex} FATAL ERROR:`, err.message);
          geoResult = { geocodeMethod: 'unresolved' };
        } finally {
          let isGeocoded = 0;
          let isFailed = 0;
          if (geoResult?.lat) {
            isGeocoded = 1;
          } else if (geoResult?.geocodeMethod === 'unresolved') {
            isFailed = 1;
          }

          console.log(`[PIPELINE] Row ${record.rowIndex}: Finalizing progress update...`);
          await BeneficiaryDataset.collection.updateOne(
            { _id: datasetObjectId },
            { 
              $inc: { 
                'processingStats.processedCount': 1,
                'processingStats.geocodedCount': isGeocoded,
                'processingStats.failedCount': isFailed
              } 
            }
          );
        }
      }));

      // STRATEGIC: Incremental Project Updates (WOW Factor & Live Dashboard)
      if (projectObjectId && zoneIndex !== null && zoneIndex !== undefined) {
        const Project = require('../models/Project');
        const zIdx = Number(zoneIndex);
        const currentProgress = await BeneficiaryDataset.collection.findOne({ _id: datasetObjectId });
        const pCount = currentProgress?.processingStats?.processedCount || 0;
        
        console.log(`[PIPELINE] Sub-Batch Finish. Reporting incremental progress: ${pCount}/${total}`);
        
        await Project.findByIdAndUpdate(projectObjectId, {
          $set: { 
            [`beneficiarySummary.zoneStats.${zIdx}.count`]: pCount,
            [`beneficiarySummary.zoneStats.${zIdx}.status`]: 'processing'
          }
        });
      }
    }

  // 1. PROJECT AGGREGATION FIRST (Ensures UI sees data before 'Synced' flip)
  if (projectObjectId && zoneIndex !== null && zoneIndex !== undefined) {
    console.log('--- STARTING FINAL PROJECT AGGREGATION ---');
    const Project = require('../models/Project');
    const zIdx = Number(zoneIndex);
    const updatePath = `beneficiarySummary.zoneStats.${zIdx}`;
    
    // Force link all beneficiaries in this dataset to the project
    await Beneficiary.updateMany(
        { datasetId: datasetObjectId },
        { $set: { projectId: projectObjectId } }
    );

    const finalTotal = await Beneficiary.countDocuments({ datasetId: datasetObjectId });
    const finalGeocoded = await Beneficiary.countDocuments({ datasetId: datasetObjectId, 'geo.lat': { $exists: true, $ne: null } });

    console.log(`[PIPELINE] FINAL AUDIT: Total=${finalTotal} Geocoded=${finalGeocoded}`);

    await Project.findByIdAndUpdate(projectObjectId, {
      $set: {
        [updatePath]: {
          status: 'complete',
          count: finalTotal,
          geocodedCount: finalGeocoded,
          failedCount: finalTotal - finalGeocoded,
          datasetId: datasetObjectId,
          datasetName: (await BeneficiaryDataset.collection.findOne({ _id: datasetObjectId }))?.name || 'Tactical Feed',
          lastUpdated: new Date()
        }
      }
    });

    const project = await Project.findById(projectObjectId);
    const zoneStats = project.beneficiarySummary?.zoneStats || {};
    const aggregateTotal = Object.values(zoneStats).reduce((acc, stats) => acc + (Number(stats?.count) || 0), 0);

    await Project.findByIdAndUpdate(projectObjectId, {
      $set: { 'beneficiarySummary.totalCount': aggregateTotal }
    });
    console.log('--- FINAL PROJECT AGGREGATION COMPLETE ---');
  }

  // 2. FINALIZE DATASET LAST (The final 'Complete' signal)
  await BeneficiaryDataset.collection.updateOne(
    { _id: datasetObjectId },
    {
      $set: {
        'processingStats.status': 'complete',
        'processingStats.geocodedCount': geocodedCount,
        'processingStats.failedCount': failedCount,
        'processingStats.processingTimeMs': Date.now() - startTime
      }
    }
  );
};

module.exports = { runGeocodingPipeline };
