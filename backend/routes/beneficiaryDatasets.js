const express = require('express');
const router = express.Router();
const { uploadBeneficiary } = require('../middleware/uploadMiddleware');
const BeneficiaryDataset = require('../models/BeneficiaryDataset');
const Beneficiary = require('../models/Beneficiary');
const Project = require('../models/Project');
const { runGeocodingPipeline } = require('../services/geocodingPipeline');
const { clusterOutOfZoneRecords } = require('../services/beneficiaryClusterer');

// 1. UPLOAD NEW DATASET
router.post('/', uploadBeneficiary.single('file'), async (req, res) => {
  try {
    const { name, description, uploadedBy, orgId, tags } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const dataset = await BeneficiaryDataset.create({
      name,
      description,
      uploadedBy,
      orgId,
      tags: tags ? JSON.parse(tags) : [],
      sourceFile: {
        originalName: req.file.originalname,
        storagePath: req.file.path,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size
      },
      processingStats: { status: 'pending' }
    });

    // We respond immediately, geocoding starts when columns are mapped
    res.status(201).json(dataset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. LIST DATASETS
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

const { getFilePreview } = require('../services/fileParser');
const fs = require('fs');
const { parse } = require('csv-parse');
const XLSX = require('xlsx');

// ... (previous routes)

// 2.5 GET FILE PREVIEW & SUGGESTIONS
router.get('/:id/preview', async (req, res) => {
  try {
    const dataset = await BeneficiaryDataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });
    
    const preview = await getFilePreview(dataset.sourceFile.storagePath);
    res.json(preview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. START PROCESSING (Triggered after column mapping)
router.post('/:id/process', async (req, res) => {
  try {
    const { columnMapping, projectId } = req.body;
    const dataset = await BeneficiaryDataset.findByIdAndUpdate(req.params.id, {
      columnMapping,
      'processingStats.status': 'processing'
    }, { new: true });

    // ─── RECORD CREATION ───
    // Before geocoding, we must convert file rows into Beneficiary documents
    const ext = dataset.sourceFile.storagePath.split('.').pop().toLowerCase();
    let rows = [];

    if (ext === 'csv') {
      const fileContent = fs.readFileSync(dataset.sourceFile.storagePath);
      rows = await new Promise((resolve, reject) => {
        parse(fileContent, { columns: true, skip_empty_lines: true }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } else {
      const workbook = XLSX.readFile(dataset.sourceFile.storagePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }

    // Bulk create beneficiary records
    const beneficiaries = rows.map((row, idx) => ({
      datasetId: dataset._id,
      rowIndex: idx + 1,
      name: row[columnMapping.name],
      phone: row[columnMapping.phone],
      rawLocation: row[columnMapping.address] || (columnMapping.lat ? `${row[columnMapping.lat]}, ${row[columnMapping.lng]}` : ''),
      needCategory: row[columnMapping.needCategory] || 'other',
      severity: parseInt(row[columnMapping.severity]) || 5
    }));

    await Beneficiary.deleteMany({ datasetId: dataset._id }); // Clear if re-processing
    await Beneficiary.insertMany(beneficiaries);

    // Load zones if linked to project
    let zones = [];
    if (projectId) {
      const project = await Project.findById(projectId);
      zones = project?.regions || [];
    }

    // RUN ASYNC GEOCODING
    runGeocodingPipeline(dataset._id, zones).catch(err => {
      console.error(`[PIPELINE] Fatal crash for dataset ${dataset._id}:`, err);
    });

    res.json({ message: 'Records created and geocoding started', count: beneficiaries.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. GET JOB STATUS
router.get('/:id/status', async (req, res) => {
  try {
    const dataset = await BeneficiaryDataset.findById(req.params.id);
    res.json(dataset.processingStats);
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

// 6. LINK DATASET TO PROJECT
router.post('/link-to-project', async (req, res) => {
  try {
    const { projectId, datasetId } = req.body;
    
    // Update project with the link
    await Project.findByIdAndUpdate(projectId, {
      $addToSet: { beneficiaryDatasets: { datasetId } }
    });

    // Re-run zone intersection for this project's zones
    const project = await Project.findById(projectId);
    const zones = project.regions || [];
    
    // Start async re-processing for the specific project context
    runGeocodingPipeline(datasetId, zones);

// 7. RESOLVE OUT-OF-ZONE RECORDS
router.post('/:id/resolve', async (req, res) => {
  try {
    const { beneficiaryIds, action, zoneId, projectId } = req.body;
    const datasetId = req.params.id;

    if (action === 'exclude') {
      await Beneficiary.updateMany(
        { _id: { $in: beneficiaryIds } },
        { 'zoneAssignment.status': 'excluded', 'zoneAssignment.resolvedBy': 'admin_exclude' }
      );
    } else if (action === 'reassign_zone') {
      await Beneficiary.updateMany(
        { _id: { $in: beneficiaryIds } },
        { 
          'zoneAssignment.status': 'matched', 
          'zoneAssignment.assignedZoneId': String(zoneId),
          'zoneAssignment.resolvedBy': 'admin_reassign' 
        }
      );
    } else if (action === 'expand_zone') {
      // Find the furthest beneficiary in this set to determine new radius
      const records = await Beneficiary.find({ _id: { $in: beneficiaryIds } });
      const project = await Project.findById(projectId);
      const zoneIdx = parseInt(zoneId);
      const zone = project.regions[zoneIdx];

      let maxDist = zone.radius;
      const { calculateHaversineDistance } = require('../services/logic');

      records.forEach(r => {
        const d = calculateHaversineDistance(r.geo.lat, r.geo.lng, zone.center.lat, zone.center.lng);
        if (d > maxDist) maxDist = d;
      });

      // Update project zone radius (MANDATORY PHASE 2 MUTATION)
      const newRadius = Math.ceil(maxDist + 0.5); // Add 500m buffer
      project.regions[zoneIdx].radius = newRadius;
      
      // Mark these records as matched
      await Beneficiary.updateMany(
        { _id: { $in: beneficiaryIds } },
        { 
          'zoneAssignment.status': 'matched', 
          'zoneAssignment.assignedZoneId': String(zoneId),
          'zoneAssignment.resolvedBy': 'admin_expand'
        }
      );

      await project.save();
    }

    // Recompute Summary Stats with Granular Zone Breakdown
    const allRecords = await Beneficiary.find({ datasetId });
    const matched = allRecords.filter(r => r.zoneAssignment.status === 'matched');
    
    // Group by zone
    const zoneCounts = {};
    matched.forEach(r => {
      const zid = r.zoneAssignment.assignedZoneId;
      zoneCounts[zid] = (zoneCounts[zid] || 0) + 1;
    });

    const project = await Project.findById(projectId);
    const perZone = (project.regions || []).map((z, idx) => ({
      zoneId: String(idx),
      zoneName: z.name || `Area ${idx + 1}`,
      count: zoneCounts[String(idx)] || 0
    }));

    const summary = {
      totalCount: matched.length,
      outOfZoneCount: allRecords.filter(r => r.zoneAssignment.status === 'out_of_zone').length,
      unresolvedCount: allRecords.filter(r => r.zoneAssignment.status === 'geocode_failed').length,
      perZone: perZone,
      lastUpdated: new Date()
    };

    // Update Project Summary if linked
    if (projectId) {
      await Project.findByIdAndUpdate(projectId, { beneficiarySummary: summary });
    }

    res.json({ message: 'Resolution applied', summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
