const axios = require('axios');
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
const runGeocodingPipeline = async (datasetId, zones = []) => {
  const dataset = await BeneficiaryDataset.findById(datasetId);
  if (!dataset) return;

  await BeneficiaryDataset.findByIdAndUpdate(datasetId, {
    'processingStats.status': 'processing'
  });

  const records = await Beneficiary.find({ datasetId });
  const total = records.length;
  let processed = 0;
  let geocodedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (const record of records) {
    try {
      let geoResult = null;

      // 1. CHECK CACHE FIRST (Cost Shield)
      const normalized = normalizeIndianAddress(record.rawLocation);
      const cached = await GeocodingCache.findOne({ normalizedAddress: normalized });

      if (cached) {
        geoResult = {
          lat: cached.lat,
          lng: cached.lng,
          formattedAddress: cached.formattedAddress,
          placeId: cached.placeId,
          confidenceScore: cached.confidenceScore,
          geocodeMethod: 'geocoded' // Cached items were geocoded
        };
      } else {
        // 2. CALL GOOGLE API
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: normalized,
            key: process.env.GOOGLE_MAPS_API_KEY,
            region: 'in',
            language: 'en'
          }
        });

        if (response.data.status === 'OK') {
          const result = response.data.results[0];
          const confidence = computeConfidence(result);
          
          geoResult = {
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
            formattedAddress: result.formatted_address,
            placeId: result.place_id,
            confidenceScore: confidence,
            geocodeMethod: 'geocoded'
          };

          // Update Cache
          await GeocodingCache.create({
            normalizedAddress: normalized,
            ...geoResult
          });
        } else {
          geoResult = { geocodeMethod: 'unresolved' };
          failedCount++;
        }
      }

      // 3. ZONE INTERSECTION
      let zoneAssignment = { status: 'geocode_failed' };
      if (geoResult && geoResult.lat) {
        zoneAssignment = resolveZoneAssignment(geoResult.lat, geoResult.lng, zones);
      }

      // 4. SAVE RECORD
      await Beneficiary.findByIdAndUpdate(record._id, {
        geo: geoResult,
        zoneAssignment,
        'geo.geocodedAt': new Date()
      });

      if (geoResult?.lat) geocodedCount++;

      // Progress Update
      processed++;
      if (processed % 10 === 0) {
        await BeneficiaryDataset.findByIdAndUpdate(datasetId, {
          'processingStats.geocodedCount': geocodedCount,
          'processingStats.failedCount': failedCount,
          'processingStats.totalRows': total
        });
      }

      // Rate Limiting (Simulated batching)
      if (processed % GEOCODING_GUARDS.batchSize === 0) {
        await new Promise(r => setTimeout(r, GEOCODING_GUARDS.delayBetweenBatchesMs));
      }

    } catch (err) {
      console.error(`[GEOCODE] Row ${record.rowIndex} failed:`, err.message);
      failedCount++;
    }
  }

  // Finalize Dataset
  await BeneficiaryDataset.findByIdAndUpdate(datasetId, {
    'processingStats.status': 'complete',
    'processingStats.geocodedCount': geocodedCount,
    'processingStats.failedCount': failedCount,
    'processingStats.processingTimeMs': Date.now() - startTime
  });
};

module.exports = { runGeocodingPipeline };
