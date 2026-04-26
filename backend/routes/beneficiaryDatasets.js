const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { uploadBeneficiary } = require('../middleware/uploadMiddleware');
const BeneficiaryDataset = require('../models/BeneficiaryDataset');
const Beneficiary = require('../models/Beneficiary');
const Project = require('../models/Project');
const { runGeocodingPipeline } = require('../services/geocodingPipeline');
const { clusterOutOfZoneRecords } = require('../services/beneficiaryClusterer');
const { getFilePreview } = require('../services/fileParser');
const fs = require('fs');
const { parse } = require('csv-parse');
const XLSX = require('xlsx');

// 1. UPLOAD NEW DATASET
router.post('/', uploadBeneficiary.single('file'), async (req, res) => {
  try {
    const { name, uploadedBy, orgId } = req.body;
    
    const dataset = await BeneficiaryDataset.create({
      name,
      uploadedBy,
      orgId,
      sourceFile: {
        originalName: req.file.originalname,
        storagePath:  req.file.path,
        mimeType:     req.file.mimetype,
        sizeBytes:    req.file.size
      }
    });

    res.status(201).json(dataset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. GET ALL DATASETS
router.get('/', async (req, res) => {
  try {
    const { orgId, uploadedBy } = req.query;
    const filter = {};
    if (orgId) filter.orgId = orgId;
    if (uploadedBy) filter.uploadedBy = uploadedBy;

    const datasets = await BeneficiaryDataset.find(filter).sort({ createdAt: -1 });
    res.json(datasets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2.5 GET FILE PREVIEW & SUGGESTIONS
router.get('/:id/preview', async (req, res) => {
  try {
    const dataset = await BeneficiaryDataset.collection.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
    
    const preview = await getFilePreview(dataset.sourceFile.storagePath);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. START PROCESSING V2 (Bypasses ghost processes and old schema caches)
router.post('/:id/v2/process', async (req, res) => {
  try {
    const { columnMapping, projectId, zoneId } = req.body;
    console.log(`[INGESTION] INIT: Dataset=${req.params.id} Project=${projectId} Zone=${zoneId}`);
    
    const dataset = await BeneficiaryDataset.collection.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

    // STRATEGIC FIX: Encode multi-select arrays as strings to bypass Mongoose's rigid type-checking
    const encodedMapping = {};
    Object.keys(columnMapping).forEach(key => {
      const val = columnMapping[key];
      encodedMapping[key] = Array.isArray(val) ? val.join('|||') : val;
    });

    // STRATEGIC FIX: Sanitize keys of columnMapping for MongoDB safety (Dots and $ are illegal in keys)
    const sanitizeMapping = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const sanitized = {};
      Object.keys(obj).forEach(key => {
        const safeKey = key.replace(/\./g, '_DOT_').replace(/\$/g, '_DOLLAR_');
        sanitized[safeKey] = obj[key];
      });
      return sanitized;
    };

    // Update dataset status directly via native driver
    await BeneficiaryDataset.collection.updateOne(
      { _id: dataset._id },
      { 
        $set: { 
          columnMapping: sanitizeMapping(encodedMapping),
          'processingStats.status': 'processing'
        } 
      }
    );

    // ─── STREAMING RECORD CREATION ───
    const storagePath = dataset.sourceFile.storagePath;
    if (!fs.existsSync(storagePath)) {
      throw new Error(`Storage file missing at: ${storagePath}`);
    }

    const ext = storagePath.split('.').pop().toLowerCase();
    const batchSize = 1000;
    let currentBatch = [];
    let totalProcessed = 0;

    const saveBatch = async () => {
      if (currentBatch.length > 0) {
        try {
          console.log(`[INGESTION] Saving batch of ${currentBatch.length} records...`);
          if (currentBatch.length > 0) console.log(`[INGESTION] SAMPLE RECORD:`, JSON.stringify(currentBatch[0]).slice(0, 500));
          
          // STRATEGIC BYPASS: Use native driver to avoid schema validation 'Black Holes'
          await Beneficiary.collection.insertMany(currentBatch, { ordered: false });
          console.log(`[INGESTION] Batch saved successfully.`);
          currentBatch = [];
        } catch (dbErr) {
          console.warn(`[INGESTION] Batch had partial failures:`, dbErr.message);
          // If some failed, we still clear the batch to proceed with others
          currentBatch = [];
        }
      }
    };

    await Beneficiary.deleteMany({ datasetId: dataset._id });

    const safeString = (val) => (val === null || val === undefined) ? '' : String(val).trim();
    const safeNum = (val, fallback = null) => {
      const n = parseFloat(val);
      return isNaN(n) ? fallback : n;
    };

    const processRow = (row, index) => {
      totalProcessed++;
      const getVal = (field) => {
        let mapping = columnMapping[field];
        if (typeof mapping === 'string' && mapping.includes('|||')) {
          mapping = mapping.split('|||');
        }

        if (!mapping) return '';
        if (Array.isArray(mapping)) return mapping.map(col => safeString(row[col])).filter(Boolean).join(' ');
        return safeString(row[mapping]);
      };

      const name = safeString(getVal('name')) || 'Unknown Beneficiary';
      const phone = safeString(getVal('phone')) || 'N/A';
      const age = safeNum(getVal('age'));
      
      const rawGender = safeString(getVal('gender')).toLowerCase();
      const gender = ['male', 'female', 'other', 'prefer_not_to_say'].includes(rawGender) ? rawGender : 'other';

      const rawSeverity = safeString(getVal('needSeverity')).toLowerCase();
      const needSeverity = ['low', 'medium', 'high'].includes(rawSeverity) ? rawSeverity : 'medium';

      const geoParts = [
        getVal('address'),
        getVal('village'),
        getVal('district'),
        getVal('state')
      ].filter(part => part && part.length > 0);

      let rawLocation = geoParts.join(', ');
      
      // STRATEGIC FALLBACK: If the user provided no address details, use the Zone Name
      // This ensures we at least get a coordinate in the correct city/region.
      if (!rawLocation || rawLocation.trim().length < 2) {
        const zoneName = data?.regions?.[zoneId]?.name || 'Unknown Zone';
        console.log(`[INGESTION] Row ${index}: No address found. Falling back to Zone: ${zoneName}`);
        rawLocation = zoneName;
      }

      if (index < 5) console.log(`[INGESTION] Row ${index} mapped location: "${rawLocation}"`);

      const mappedColumns = Object.values(columnMapping).flat();
      const customFields = new Map();
      Object.keys(row).forEach(col => { 
        if (!mappedColumns.includes(col)) {
           const val = row[col];
           if (val !== null && val !== undefined) customFields.set(col, safeString(val));
        } 
      });

      // STRATEGIC: Ensure the Project ID is never lost during orchestration
      const rawProjectId = projectId || req.body.projectId;
      console.log(`[INGESTION] Mapping Row ${index} -> Project: ${rawProjectId}`);
      
      const safeProjectId = mongoose.Types.ObjectId.isValid(rawProjectId) 
        ? new mongoose.Types.ObjectId(rawProjectId) 
        : null;

      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        datasetId: dataset._id,
        projectId: safeProjectId,
        rowIndex: index + 1,
        name,
        firstName,
        lastName,
        age,
        gender,
        phone,
        state: safeString(getVal('state')) || undefined,
        district: safeString(getVal('district')) || undefined,
        village: safeString(getVal('village')) || undefined,
        socioEconomic: {
          incomeRange: safeString(getVal('incomeRange')) || 'unknown',
          familySize: safeNum(getVal('familySize'), 1),
          occupation: safeString(getVal('occupation')) || 'unknown',
          educationLevel: safeString(getVal('educationLevel')) || 'unknown',
          housingCondition: safeString(getVal('housingCondition')) || 'unknown',
          basicUtilities: (typeof getVal('basicUtilities') === 'string') ? getVal('basicUtilities').split(',').map(s => s.trim()) : []
        },
        primaryNeed: safeString(getVal('primaryNeed')) || 'general',
        needSeverity,
        rawLocation,
        customFields,
        // UI Compatibility Fallbacks
        aadharMasked: (getVal('aadhaar') || getVal('id') || '').toString().slice(-4),
        registeredAt: new Date(),
        zoneAssignment: {
          assignedZoneId: zoneId !== undefined ? String(zoneId) : undefined,
          status: 'missing_location'
        }
      };
    };

    if (ext === 'csv') {
      const parser = fs.createReadStream(storagePath).pipe(parse({ columns: true, skip_empty_lines: true }));
      let i = 0;
      for await (const row of parser) {
        currentBatch.push(processRow(row, i++));
        if (currentBatch.length >= batchSize) await saveBatch();
      }
      await saveBatch();
      totalProcessed = i;
    } else {
      const workbook = XLSX.readFile(storagePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      for (let i = 0; i < rows.length; i++) {
        currentBatch.push(processRow(rows[i], i));
        if (currentBatch.length >= batchSize) await saveBatch();
      }
      await saveBatch();
      totalProcessed = rows.length;
    }

    // STRATEGIC: Finalize dataset metadata before geocoding starts
    await BeneficiaryDataset.collection.updateOne(
      { _id: dataset._id },
      { 
        $set: { 
          'processingStats.totalRows': totalProcessed,
          'processingStats.status': 'ingested'
        } 
      }
    );

    let zones = [];
    if (projectId && projectId.length === 24) {
      const project = await Project.findById(projectId);
      zones = project?.regions || [];
    }

    runGeocodingPipeline(dataset._id, zones, projectId, zoneId).catch(err => {
      console.error(`[PIPELINE] Fatal crash for dataset ${dataset._id}:`, err);
    });

    res.json({ message: 'Success', count: totalProcessed });
  } catch (err) {
    console.error('[INGESTION] Fatal Error:', err);
    res.status(500).json({ 
      message: `Ingestion Failed: ${err.message}`,
      stack: err.stack
    });
  }
});

// 4. GET JOB STATUS
router.get('/:id/status', async (req, res) => {
  try {
    const dataset = await BeneficiaryDataset.collection.findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
    const stats = dataset.processingStats || {};
    res.json({
      ...stats,
      count: stats.totalRows || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. GET OUT-OF-ZONE CLUSTERS
router.get('/:id/clusters', async (req, res) => {
  try {
    const records = await Beneficiary.find({ datasetId: req.params.id });
    const clusters = clusterOutOfZoneRecords(records);
    res.json(clusters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. RESOLVE CLUSTERS
router.post('/:id/resolve', async (req, res) => {
  try {
    const { action, beneficiaryIds, zoneId, projectId } = req.body;
    
    if (action === 'admin_reassign') {
      await Beneficiary.updateMany(
        { _id: { $in: beneficiaryIds } },
        { 
          'zoneAssignment.status': 'matched', 
          'zoneAssignment.assignedZoneId': String(zoneId),
          'zoneAssignment.resolvedBy': 'admin_reassign',
          'zoneAssignment.resolvedAt': new Date()
        }
      );
    } else if (action === 'admin_exclude') {
      await Beneficiary.updateMany(
        { _id: { $in: beneficiaryIds } },
        { 
          'zoneAssignment.status': 'excluded',
          'zoneAssignment.resolvedBy': 'admin_exclude',
          'zoneAssignment.resolvedAt': new Date()
        }
      );
    }

    const allRecords = await Beneficiary.find({ datasetId: req.params.id });
    const matched = allRecords.filter(r => r.zoneAssignment.status === 'matched');
    const perZone = {};
    matched.forEach(r => {
      const zid = r.zoneAssignment.assignedZoneId;
      perZone[zid] = (perZone[zid] || 0) + 1;
    });

    const summary = {
      totalCount: matched.length,
      outOfZoneCount: allRecords.filter(r => r.zoneAssignment.status === 'out_of_zone').length,
      unresolvedCount: allRecords.filter(r => r.zoneAssignment.status === 'geocode_failed').length,
      perZone,
      lastUpdated: new Date()
    };

    if (projectId) {
      await Project.findByIdAndUpdate(projectId, { beneficiarySummary: summary });
    }

    res.json({ message: 'Resolution applied', summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
