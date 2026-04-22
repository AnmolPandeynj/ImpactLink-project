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

// Firebase Auth Middleware
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!admin.apps.length) {
    // LOCAL TEST BYPASS: If no firebase admin, provide a stable mock identity
    // This allows local dev to hit /api/users/me without credentials
    req.user = { 
      uid: 'local_dev_user_123', 
      email: 'local-dev@impactlink.io', 
      name: 'Local Developer' 
    };
    return next();
  }

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
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

// --- ROUTES ---
const userRoutes = require('./routes/users');
const volunteerRoutes = require('./routes/volunteer');

app.use('/api/users', verifyToken, userRoutes);
app.use('/api/volunteer', verifyToken, volunteerRoutes);

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
    const records = await Beneficiary.find().populate('locationId');
    // Decrypt names for display (only for authorized users)
    const decrypted = records.map(r => ({
      ...r.toObject(),
      firstName: decrypt(r.firstName),
      lastName: decrypt(r.lastName),
      contactPhone: decrypt(r.contactPhone)
    }));
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
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/projects/:id', verifyToken, async (req, res) => {
  try {
    const updated = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Project not found' });
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
        query.projectIds = req.query.projectId;
      }
      // If project is Global, query remains {} to fetch everyone
    }

    const volunteers = await Volunteer.find(query).populate('locationId').populate('projectIds');
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
