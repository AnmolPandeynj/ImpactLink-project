const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');
const Project = require('../models/Project');
const MissionHistory = require('../models/MissionHistory');
const checkRole = require('../middleware/checkRole');
const { findSemanticMatches } = require('../services/semanticEngine');

// ─── USER ONBOARDING & IDENTITY ───────────────────────────────────────────

/**
 * POST /api/users/setup
 * First-time setup for Firebase users to select a role and link to a volunteer profile.
 */
router.post('/users/setup', async (req, res) => {
  try {
    const { role, volunteerCode } = req.body;
    
    if (!req.user) {
      console.error('[SETUP] Fatal: req.user is missing despite middleware passage');
      return res.status(401).json({ error: 'Identity verification context missing.' });
    }

    const uid = req.user.uid;
    const email = req.user.email || 'guest@impactlink.dev';

    let user = await User.findOne({ uid });
    if (user) return res.status(400).json({ error: 'User already configured.' });

    let linkedVolunteerId = null;

    if (role === 'Volunteer' && volunteerCode) {
      const vol = await Volunteer.findOne({ volunteerCode });
      if (!vol) return res.status(404).json({ error: 'Invalid volunteer enrollment code.' });
      
      linkedVolunteerId = vol._id;
      // Single-use code: nullify after successful link
      vol.volunteerCode = null;
      await vol.save();
    }

    user = new User({
      uid,
      email,
      displayName: req.user.name || email.split('@')[0],
      role,
      linkedVolunteerId,
      onboardingComplete: true
    });

    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/me
 * Returns current session user with populated volunteer details.
 */
router.get('/users/me', async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid }).populate('linkedVolunteerId');
    if (!user) return res.status(404).json({ error: 'Identity not found.' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── VOLUNTEER CORE OPS ───────────────────────────────────────────────────

/**
 * GET /api/volunteer/me
 * Returns the Volunteer profile linked to the current user.
 */
router.get('/volunteer/me', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  try {
    const vol = await Volunteer.findById(req.impactUser.linkedVolunteerId).populate({
      path: 'projectIds',
      model: Project // Use the imported model directly
    });
    if (!vol) {
      console.warn(`[AUTH] Volunteer profile missing for user ${req.impactUser.uid} (Link: ${req.impactUser.linkedVolunteerId})`);
      return res.status(404).json({ error: `Volunteer profile missing for link ID ${req.impactUser.linkedVolunteerId}` });
    }
    
    console.log(`[VOLUNTEER] Found ${vol.projectIds?.length} projects for ${vol.name}. First project name: ${vol.projectIds?.[0]?.name}`);
    
    // Privacy: exclude admin-only sensitive metrics if needed
    const response = vol.toObject();
    delete response.performanceScore; 
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/volunteer/me
 * Updates volunteer-controlled fields (availability, skills, transport).
 */
router.patch('/volunteer/me', checkRole('Volunteer'), async (req, res) => {
  try {
    const allowedUpdates = [
      'availability', 'skills', 'vehicleType', 'vehicleCapacity',
      'travelRadiusKm', 'emergencyContact', 'contactPhone', 'address',
      'liveLocation'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) updates[key] = req.body[key];
    });

    const vol = await Volunteer.findByIdAndUpdate(
      req.impactUser.linkedVolunteerId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(vol);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/volunteer/me/location
 * Volunteers push their current GPS coordinates.
 * Called manually ("Share Location" button) or automatically while en_route/on_site.
 */
router.post('/volunteer/me/location', checkRole('Volunteer'), async (req, res) => {
  try {
    const { lat, lng, accuracy } = req.body;

    // Validate coordinate bounds
    if (lat == null || lng == null) {
      return res.status(400).json({ error: 'lat and lng are required.' });
    }
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'lat must be between -90 and 90.' });
    }
    if (lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'lng must be between -180 and 180.' });
    }

    const now = new Date();
    const vol = await Volunteer.findByIdAndUpdate(
      req.impactUser.linkedVolunteerId,
      {
        $set: {
          'liveLocation.lat':       parseFloat(lat),
          'liveLocation.lng':       parseFloat(lng),
          'liveLocation.accuracy':  accuracy ? parseFloat(accuracy) : null,
          'liveLocation.updatedAt': now,
          lastActive: now
        }
      },
      { new: true }
    );

    if (!vol) return res.status(404).json({ error: 'Volunteer profile not found.' });

    res.json({
      success: true,
      liveLocation: vol.liveLocation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── ASSIGNMENT LIFECYCLE ────────────────────────────────────────────────

/**
 * PATCH /api/volunteer/me/assignment/status
 * Sequential status tracker: accepted -> en_route -> on_site -> completed.
 */
router.patch('/volunteer/me/assignment/status', checkRole('Volunteer'), async (req, res) => {
  try {
    const { status } = req.body;
    const vol = await Volunteer.findById(req.impactUser.linkedVolunteerId);
    
    if (!vol.currentAssignmentId) return res.status(400).json({ error: 'No active mission assigned.' });

    const validTransitions = {
      'pending_accept': ['accepted'],
      'accepted': ['en_route'],
      'en_route': ['on_site'],
      'on_site': ['completed']
    };

    if (!validTransitions[vol.assignmentStatus]?.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid transition from ${vol.assignmentStatus} to ${status}.` 
      });
    }

    vol.assignmentStatus = status;
    if (status === 'accepted') vol.assignmentAcceptedAt = new Date();

    if (status === 'completed') {
      // Archive to History
      const history = new MissionHistory({
        volunteerId: vol._id,
        allocationId: vol.currentAssignmentId,
        status: 'completed',
        completedAt: new Date()
      });
      await history.save();

      // Clear current workload
      vol.currentAssignmentId = null;
      vol.assignmentStatus = 'unassigned';
      vol.totalMissionsCompleted += 1;
    }

    await vol.save();
    res.json({ status: vol.assignmentStatus, currentAssignmentId: vol.currentAssignmentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEMANTIC ORCHESTRATION ───────────────────────────────────────────────

/**
 * POST /api/allocate/semantic
 * Advanced RAG-driven semantic matching. Finds best volunteers for a mission context.
 */
router.post('/allocate/semantic', checkRole('Administrator'), async (req, res) => {
  try {
    const { missionContext, volunteerIds } = req.body;
    
    // STRATEGIC: Pull candidates and include their hidden high-dimensional embeddings
    const candidates = await Volunteer.find({ 
      _id: { $in: volunteerIds },
      status: 'Active'
    }).select('+embedding');

    const matches = await findSemanticMatches(missionContext, candidates);
    
    // Format response for frontend consumption
    const result = matches.map(m => ({
      volunteerId: m.volunteer._id,
      semanticScore: m.semanticScore
    }));

    res.json(result);
  } catch (err) {
    console.error('Semantic Allocation API Failure:', err);
    res.status(500).json({ error: 'Semantic allocation failed: ' + err.message });
  }
});

module.exports = router;
