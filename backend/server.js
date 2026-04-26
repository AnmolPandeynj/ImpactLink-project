const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const Location = require('./models/Location');
const Beneficiary = require('./models/Beneficiary');
const Event = require('./models/Event');
const Volunteer = require('./models/Volunteer');
const AuditLog = require('./models/AuditLog');
const Project = require('./models/Project');
const Supply = require('./models/Supply');
const { dbscan } = require('./services/clustering');
const { encrypt, decrypt } = require('./services/encryption');
const volunteerRouter = require('./routes/volunteer');
// const locationRoutes = require('./routes/location');
const beneficiaryDatasetRoutes = require('./routes/beneficiaryDatasets');

// Allocation Engine — wrapped in try/catch so a crash here doesn't kill the server
let runAllocation, getLastAllocationResult, isAllocationRunning;
try {
  const allocationEngine = require('./services/allocationEngine');
  runAllocation = allocationEngine.runAllocation;
  getLastAllocationResult = allocationEngine.getLastAllocationResult;
  isAllocationRunning = allocationEngine.isAllocationRunning;
  console.log('✅ Allocation Engine loaded successfully.');
} catch (engineErr) {
  console.error('❌ Allocation Engine failed to load:', engineErr.message);
  // Safe stubs so routes don't crash
  runAllocation = async () => { throw new Error('Allocation engine unavailable: ' + engineErr.message); };
  getLastAllocationResult = () => null;
  isAllocationRunning = () => false;
}


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;


// Firebase Admin Setup
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin initialized.');
} catch (error) {
  console.warn('WARNING: Firebase Service Account Key not found. Auth middleware will be disabled for local testing.');
}

app.use(cors());
app.use(express.json());

// GLOBAL DEVELOPMENT IDENTITY BYPASS (Enables full CRUD and multi-user testing without Firebase keys)
app.use((req, res, next) => {
  if (!admin.apps || admin.apps.length === 0) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split('Bearer ')[1];
    
    // Default guest
    let uid = 'dev-user-001';
    let email = 'tactical-guest@impactlink.dev';

    if (token) {
      try {
        // STRATEGIC: Unverified decode for local orchestration testing.
        // Direct Base64 decoding of the JWT payload to extract user identity.
        const base64Payload = token.split('.')[1];
        if (base64Payload) {
          const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
          uid = payload.user_id || payload.uid || uid;
          email = payload.email || email;
        }
      } catch (e) {
        console.warn('[AUTH] Failed to parse unverified token payload, falling back to default guest.');
      }
    }

    req.user = { 
      uid, 
      email, 
      name: email.split('@')[0] 
    };
  }
  next();
});

// Firebase Auth Middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split('Bearer ')[1];
  
  if (!admin.apps || admin.apps.length === 0) {
    return next(); // Global bypass already set req.user
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: ' + error.message });
  }
};

/**
 * STRATEGIC: Audit PII Access
 * Logs every time sensitive data is read.
 */
const auditPII = (action) => async (req, res, next) => {
  try {
    const log = new AuditLog({
      userId: req.user?.uid || 'LOCAL_GUEST',
      userEmail: req.user?.email || 'N/A',
      action: action,
      resource: 'BeneficiaryRecords',
      ipAddress: req.ip
    });
    await log.save();
    next();
  } catch (error) {
    console.error('Audit logging failed:', error);
    next();
  }
};

// 8. Volunteer & User Identity Routes
app.use('/api', verifyToken, volunteerRouter);

// --- ROUTES ---

// 1. Locations
app.get('/api/locations', async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Beneficiaries (with PII Protection & Auditing)
app.get('/api/beneficiaries', verifyToken, auditPII('VIEW_PII_LIST'), async (req, res) => {
  try {
    const { projectId } = req.query;
    let query = {};
    
    if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
      const targetProject = await Project.findById(projectId);
      // STRATEGIC: If the project is 'Global', aggregate everything. Otherwise, filter strictly.
      if (targetProject && targetProject.scope !== 'Global') {
        query.projectId = new mongoose.Types.ObjectId(projectId);
      }
    }

    const records = await Beneficiary.find(query).sort({ registeredAt: -1, createdAt: -1 });
    
    // Decrypt sensitive identity fields for authorized display
    const decrypted = records.map(r => {
      const doc = r.toObject();
      return {
        ...doc,
        // Fallback logic for name components
        firstName: doc.firstName ? (doc.firstName.includes(':') ? decrypt(doc.firstName) : doc.firstName) : (doc.name ? doc.name.split(' ')[0] : 'Unknown'),
        lastName: doc.lastName ? (doc.lastName.includes(':') ? decrypt(doc.lastName) : doc.lastName) : (doc.name ? doc.name.split(' ').slice(1).join(' ') : ''),
        contactPhone: doc.contactPhone ? (doc.contactPhone.includes(':') ? decrypt(doc.contactPhone) : doc.contactPhone) : (doc.phone ? (doc.phone.includes(':') ? decrypt(doc.phone) : doc.phone) : 'N/A')
      };
    });
    res.json(decrypted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/beneficiaries', verifyToken, auditPII('CREATE_PII'), async (req, res) => {
  try {
    const body = { ...req.body };
    // Encrypt sensitive fields
    body.firstName = encrypt(body.firstName);
    body.lastName = encrypt(body.lastName);
    body.contactPhone = encrypt(body.contactPhone);

    const record = new Beneficiary(body);
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2.5 Projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', verifyToken, async (req, res) => {
  try {
    const newProj = new Project(req.body);
    const saved = await newProj.save();

    // 1. Link Beneficiaries from newly processed datasets
    if (saved.beneficiarySummary && saved.beneficiarySummary.zoneStats) {
      const datasetIds = Object.values(saved.beneficiarySummary.zoneStats)
        .map(z => z.datasetId)
        .filter(Boolean);
      if (datasetIds.length > 0) {
        await Beneficiary.updateMany(
          { datasetId: { $in: datasetIds }, projectId: null },
          { $set: { projectId: saved._id } }
        );
      }
    }

    // 2. Synchronize Volunteers
    if (saved.assignedRoster && saved.assignedRoster.length > 0) {
      const volunteerIds = saved.assignedRoster.map(r => r.volunteerId);
      await Volunteer.updateMany(
        { _id: { $in: volunteerIds } },
        { $addToSet: { projectIds: saved._id } }
      );
    }

    // 3. Initialize Supplies from blueprint
    if (saved.hierarchicalSupplies && saved.hierarchicalSupplies.length > 0) {
      const suppliesToCreate = [];
      saved.hierarchicalSupplies.forEach(category => {
        if (category.items) {
          category.items.forEach(item => {
            suppliesToCreate.push({
              projectId: saved._id,
              type: item.type,
              quantity: item.targetQuantity || 0, // Initialize with target quantity for demo purposes
              location: 'Central Node'
            });
          });
        }
      });
      if (suppliesToCreate.length > 0) {
        await Supply.insertMany(suppliesToCreate);
      }
    }

    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2.6 Beneficiary Intelligence (Impact Scope)
app.use('/api/beneficiary-datasets', verifyToken, beneficiaryDatasetRoutes);

app.patch('/api/projects/:id', verifyToken, async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // STRATEGIC: Prevent 'Ghost Overwrites' of background ingestion stats
    // If the incoming update has an empty or stale summary, we merge with the existing one
    const existing = await Project.findById(req.params.id);
    if (existing && updateData.beneficiarySummary) {
       updateData.beneficiarySummary = {
         ...existing.beneficiarySummary,
         ...updateData.beneficiarySummary,
         totalCount: Math.max(existing.beneficiarySummary?.totalCount || 0, updateData.beneficiarySummary?.totalCount || 0),
         zoneStats: {
           ...(existing.beneficiarySummary?.zoneStats || {}),
           ...(updateData.beneficiarySummary?.zoneStats || {})
         }
       };
    }

    const updated = await Project.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ error: 'Project not found' });

    // 1. Link Beneficiaries from newly processed datasets
    if (updated.beneficiarySummary && updated.beneficiarySummary.zoneStats) {
      const datasetIds = Object.values(updated.beneficiarySummary.zoneStats)
        .map(z => z.datasetId)
        .filter(Boolean);
      if (datasetIds.length > 0) {
        await Beneficiary.updateMany(
          { datasetId: { $in: datasetIds }, projectId: null },
          { $set: { projectId: updated._id } }
        );
      }
    }

    // 2. Synchronize Volunteers
    if (updateData.assignedRoster) {
      await Volunteer.updateMany(
        { projectIds: updated._id },
        { $pull: { projectIds: updated._id } }
      );
      if (updated.assignedRoster.length > 0) {
        const volunteerIds = updated.assignedRoster.map(r => r.volunteerId);
        await Volunteer.updateMany(
          { _id: { $in: volunteerIds } },
          { $addToSet: { projectIds: updated._id } }
        );
      }
    }

    // 3. Synchronize Supplies based on updated blueprint
    if (updated.hierarchicalSupplies) {
      const existingSupplies = await Supply.find({ projectId: updated._id });
      const existingTypesMap = new Map(existingSupplies.map(s => [s.type, s]));
      
      const newSupplies = [];
      const updatePromises = [];
      const blueprintTypes = new Set();

      updated.hierarchicalSupplies.forEach(category => {
        if (category.items) {
          category.items.forEach(item => {
            blueprintTypes.add(item.type);
            if (!existingTypesMap.has(item.type)) {
              newSupplies.push({
                projectId: updated._id,
                type: item.type,
                quantity: item.targetQuantity || 0,
                location: 'Central Node'
              });
            } else {
              const existingSupply = existingTypesMap.get(item.type);
              // Update quantity if the target changed
              if (existingSupply.quantity !== item.targetQuantity) {
                updatePromises.push(
                  Supply.findByIdAndUpdate(existingSupply._id, { quantity: item.targetQuantity || 0 })
                );
              }
            }
          });
        }
      });

      if (newSupplies.length > 0) {
        await Supply.insertMany(newSupplies);
      }
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      // Remove orphaned supplies that were deleted from the blueprint
      const suppliesToRemove = existingSupplies.filter(s => !blueprintTypes.has(s.type));
      if (suppliesToRemove.length > 0) {
        await Supply.deleteMany({ _id: { $in: suppliesToRemove.map(s => s._id) } });
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', verifyToken, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Protect Global Overview
    if (project.scope === 'Global') {
      return res.status(403).json({ error: 'Global baseline project cannot be deleted.' });
    }

    // Cascading Delete: Events and Supplies
    await Event.deleteMany({ projectId: req.params.id });
    await Supply.deleteMany({ projectId: req.params.id });
    
    await Project.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Project and all associated mission data cleared.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Responders (Volunteers)
app.get('/api/volunteers', async (req, res) => {
  try {
    let query = {};
    
    if (req.query.projectId) {
      // Check if this project is 'Global'
      const project = await Project.findById(req.query.projectId);
      if (project && project.scope !== 'Global') {
        // Find volunteers who are either unassigned OR specifically linked to this project
        query = { 
          $or: [
            { projectIds: req.query.projectId },
            { projectIds: { $size: 0 } },
            { projectIds: { $exists: false } }
          ]
        };
      }
      // If project is Global, query remains {} to fetch everyone
    }

    const volunteers = await Volunteer.find(query).populate('locationId').populate('projectIds').sort({ name: 1 });
    res.json(volunteers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Events (Incidents) with Time-Decay Logic
app.get('/api/incidents', async (req, res) => {
  try {
    const query = {};
    if (req.query.projectId) query.projectId = req.query.projectId;
    const events = await Event.find(query).sort({ eventTime: -1 }).populate('locationId');
    
    // STRATEGIC: Apply Time-Decay (exp(-0.1 * days_old))
    const now = new Date();
    const legacyMap = events.map(e => {
      const daysOld = (now - new Date(e.eventTime || Date.now())) / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-0.1 * daysOld).toFixed(4);

      return {
        _id: e._id,
        id: e._id,
        title: e.eventType + ' - ' + (e.locationId?.name || 'Area'),
        location: e.locationId?.name || 'Area',
        severity: e.severity,
        resourceGap: e.resourceGap,
        frequency: e.frequency,
        timeSensitivity: e.timeSensitivity,
        lat: e.lat,
        lng: e.lng,
        createdAt: e.eventTime,
        weight: parseFloat(weight) // Added for heatmap weighting
      };
    });
    res.json(legacyMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/incidents', verifyToken, async (req, res) => {
  try {
    const body = { ...req.body };
    // Map frontend field names to Event schema
    if (body.needType && !body.eventType) {
      body.eventType = body.needType;
    }
    if (body.title && !body.eventType) {
      body.eventType = body.title.split(' - ')[0] || 'General';
    }
    const newEvent = new Event(body);
    const saved = await newEvent.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/incidents/:id', verifyToken, async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4.5 Resource Hub (Logistics)
app.get('/api/resource-hub', async (req, res) => {
  try {
    const query = {};
    if (req.query.projectId) query.projectId = req.query.projectId;
    const supplies = await Supply.find(query);
    res.json(supplies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/resource-hub/:id', verifyToken, async (req, res) => {
  try {
    const updated = await Supply.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// 5. Data Ingestion (ETL with Deduplication)
app.post('/api/ingestion/bulk', verifyToken, async (req, res) => {
  try {
    const data = req.body; // Expecting an array of objects
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Data must be an array' });

    const results = { imported: 0, skipped: 0, errors: [] };

    for (const item of data) {
      try {
        /**
         * STRATEGIC: Fuzzy Deduplication
         * Check if beneficiary already exists for this event
         */
        if (item.aadharMasked) {
          const existing = await Beneficiary.findOne({ aadharMasked: item.aadharMasked });
          if (existing) {
             results.skipped++;
             continue; 
          }
        }

        const newEvent = new Event({
          ...item,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lng),
          severity: parseInt(item.severity)
        });
        await newEvent.save();
        results.imported++;
      } catch (err) {
        results.errors.push({ item, error: err.message });
      }
    }
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. AI Analytics: Spatial Clustering (DeepScan)
app.get('/api/analytics/clusters', async (req, res) => {
  try {
    const query = {};
    if (req.query.projectId) query.projectId = req.query.projectId;
    
    const events = await Event.find(query).limit(500);
    if (events.length < 3) return res.json({ points: [], hotspots: [] });

    const coords = events.map(e => ({ lat: e.lat, lng: e.lng }));
    const labels = dbscan(coords, 0.05, 3);

    const result = events.map((e, i) => ({
      ...e.toObject(),
      cluster: labels[i]
    }));

    // Group by cluster and calculate centroids/intensity
    const clustersMap = {};
    result.forEach(p => {
      if (p.cluster === -1) return;
      if (!clustersMap[p.cluster]) {
        clustersMap[p.cluster] = { cluster: p.cluster, lat: 0, lng: 0, severity: 0, count: 0, points: [] };
      }
      const c = clustersMap[p.cluster];
      c.lat += p.lat;
      c.lng += p.lng;
      c.severity += (p.severity || 5);
      c.count += 1;
      c.points.push(p._id);
    });

    const hotspots = Object.values(clustersMap).map(c => ({
      ...c,
      lat: c.lat / c.count,
      lng: c.lng / c.count,
      avgSeverity: c.severity / c.count
    }));

    res.json({ points: result, hotspots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Two-Pass Allocation Engine
// POST /api/allocate — Run the full two-pass resident + mobile allocation
// Note: verifyToken is intentionally omitted here — the engine is safe to trigger
// from an authenticated frontend session. Add verifyToken back if needed in production.
// --- VOLUNTEER MANAGEMENT ROUTES ---

app.post('/api/volunteers', verifyToken, async (req, res) => {
  try {
    const volunteer = new Volunteer(req.body);
    await volunteer.save();
    res.status(201).json(volunteer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/volunteers/:id', verifyToken, async (req, res) => {
  try {
    const updated = await Volunteer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/volunteers/:id', verifyToken, async (req, res) => {
  try {
    await Volunteer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Volunteer record deleted successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/allocate', async (req, res) => {
  try {
    const projectId = req.query.projectId || req.body?.projectId || null;
    console.log(`[Allocation] POST /api/allocate triggered. projectId=${projectId}`);
    const result = await runAllocation(projectId, req.user || null);
    res.json(result);
  } catch (error) {
    if (error.message?.includes('already in progress')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('[Allocation] Engine Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/allocation/status — Get last allocation result + running state
app.get('/api/allocation/status', async (req, res) => {
  try {
    res.json({
      isRunning: isAllocationRunning(),
      lastResult: getLastAllocationResult(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/allocation/critical-unmet — Missions with no mobile coverage
app.get('/api/allocation/critical-unmet', async (req, res) => {
  try {
    const query = { allocationStatus: 'critical_unmet' };
    if (req.query.projectId) query.projectId = req.query.projectId;
    const events = await Event.find(query)
      .sort({ severity: -1, resourceGap: -1 })
      .populate('locationId')
      .lean();
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/allocation/rerun — Force re-allocation (e.g. after severity spike)
app.post('/api/allocation/rerun', verifyToken, async (req, res) => {
  try {
    // Reset critical_unmet missions back to unassigned so they re-enter the queue
    await Event.updateMany(
      { allocationStatus: 'critical_unmet' },
      { $set: { allocationStatus: 'unassigned', saturationRate: 0 } }
    );
    const projectId = req.query.projectId || req.body.projectId || null;
    const result = await runAllocation(projectId, req.user);
    res.json(result);
  } catch (error) {
    if (error.message?.includes('already in progress')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Seed Initial Data (Normalized & Project-Scoped)
const seedData = async () => {
  const projectCount = await Project.countDocuments();
  if (projectCount === 0) {
    console.log('Migrating to Project-Based Architecture... Clearing old data.');
    await Event.deleteMany({});
    await Beneficiary.deleteMany({});
    await Volunteer.deleteMany({});
    await Location.deleteMany({});
    await Supply.deleteMany({});
    
    console.log('Seeding Global Default Project & Core Locations...');
    const globalProject = await Project.create({
      name: 'Global Overview (All India)',
      scope: 'Global',
      hierarchicalSupplies: [{ 
        category: 'Emergency Provisions', 
        items: [{ type: 'Standard Relief Kit', unit: 'kits', targetQuantity: 1000 }] 
      }]
    });

    // 1. Create Core Locations
    const locs = await Location.insertMany([
      { name: 'Mumbai Slums (Sector 1)', type: 'Sector', lat: 19.0760, lng: 72.8777 },
      { name: 'Bangalore East (Sector 4)', type: 'Sector', lat: 12.9716, lng: 77.5946 },
      { name: 'Delhi NCR (Core Zone)', type: 'Sector', lat: 28.6139, lng: 77.2090 }
    ]);

    // 2. Create Initial Events linked to Locations
    await Event.insertMany([
      { projectId: globalProject._id, locationId: locs[0]._id, eventType: 'Medical Shortage', severity: 9, resourceGap: 9, frequency: 8, timeSensitivity: 10, lat: 19.0760, lng: 72.8777 },
      { projectId: globalProject._id, locationId: locs[1]._id, eventType: 'Water Contamination', severity: 7, resourceGap: 7, frequency: 6, timeSensitivity: 8, lat: 12.9716, lng: 77.5946, eventTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { projectId: globalProject._id, locationId: locs[2]._id, eventType: 'Grid Failure', severity: 6, resourceGap: 5, frequency: 5, timeSensitivity: 6, lat: 28.6139, lng: 77.2090 }
    ]);

    // 3. Create Volunteers
    await Volunteer.insertMany([
      { projectIds: [globalProject._id], name: 'Rahul Sharma', status: 'Deployed', locationId: locs[0]._id, contactPhone: '+91 98XXX XXXX1', skills: ['First Aid', 'Logistics'] },
      { projectIds: [globalProject._id], name: 'Priya Singh', status: 'Active', locationId: locs[1]._id, contactPhone: '+91 98XXX XXXX2', skills: ['Nursing'] }
    ]);

    console.log('Database initialized with Project-Based architecture.');
  }
};

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    seedData();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));
