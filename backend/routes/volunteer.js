const express = require('express');
const router = express.Router();
const Volunteer = require('../models/Volunteer');
const MissionHistory = require('../models/MissionHistory');
const Event = require('../models/Event');
const checkRole = require('../middleware/checkRole'); // Assuming verifyToken is applied before

// GET /api/volunteer/me - Returns full Volunteer doc for the linked volunteer
router.get('/me', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    if (!linkedId) return res.status(404).json({ error: 'No linked volunteer profile found.' });

    // Exclude admin-only fields in the query or mapping
    const volunteer = await Volunteer.findById(linkedId).select('-performanceScore -adminNotes');
    if (!volunteer) return res.status(404).json({ error: 'Volunteer profile not found.' });
    
    res.json(volunteer);
  } catch (error) {
    console.error('Fetch volunteer profile error:', error);
    res.status(500).json({ error: 'Failed to fetch volunteer profile.' });
  }
});

// PATCH /api/volunteer/me - Update Volunteer fields (availability, skills, logistics, etc)
router.patch('/me', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    if (!linkedId) return res.status(404).json({ error: 'No linked volunteer profile found.' });

    // Explicit Allowlist to prevent escalating privileges (as per Phase 1 spec)
    const allowedFields = ['availability', 'skills', 'vehicleType', 'vehicleCapacity', 'travelRadius', 'travelRadiusKm', 'emergencyContact', 'contactPhone', 'address'];
    const updates = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const volunteer = await Volunteer.findByIdAndUpdate(linkedId, { $set: updates }, { new: true }).select('-performanceScore -adminNotes');
    res.json(volunteer);
  } catch (error) {
    console.error('Update volunteer error:', error);
    res.status(500).json({ error: 'Failed to update volunteer profile.' });
  }
});

// GET /api/volunteer/me/assignment - Returns current assignment with populated mission data
router.get('/me/assignment', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    const volunteer = await Volunteer.findById(linkedId).populate('currentAssignment');
    
    if (!volunteer || !volunteer.currentAssignment) {
      return res.json({ assignment: null });
    }

    // Wrap assignment inside object to align with spec `{ assignment: ... }`
    res.json({
      assignment: volunteer.currentAssignment,
      status: volunteer.assignmentStatus || 'unassigned' // Backwards compatibility if field doesn't exist
    });
  } catch (error) {
    console.error('Fetch assignment error:', error);
    res.status(500).json({ error: 'Failed to fetch active assignment.' });
  }
});

// PATCH /api/volunteer/me/assignment/accept - Accept the current pending assignment
router.patch('/me/assignment/accept', checkRole('Volunteer'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    const volunteer = await Volunteer.findById(linkedId);
    
    if (!volunteer || volunteer.assignmentStatus !== 'pending_accept') {
      return res.status(400).json({ error: 'No pending assignment to accept.' });
    }

    volunteer.assignmentStatus = 'accepted';
    volunteer.assignmentAcceptedAt = new Date();
    await volunteer.save();

    res.json({ success: true, assignmentStatus: volunteer.assignmentStatus });
  } catch (error) {
    console.error('Accept assignment error:', error);
    res.status(500).json({ error: 'Failed to accept assignment.' });
  }
});

// PATCH /api/volunteer/me/assignment/status - Progress assignment flow
router.patch('/me/assignment/status', checkRole('Volunteer'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    const { status } = req.body;
    const volunteer = await Volunteer.findById(linkedId);
    
    // Validate Current State
    const validTransitions = {
      'accepted': 'en_route',
      'en_route': 'on_site',
      'on_site': 'completed'
    };

    if (validTransitions[volunteer.assignmentStatus] !== status) {
       return res.status(400).json({ error: `Invalid transition from ${volunteer.assignmentStatus} to ${status}` });
    }

    volunteer.assignmentStatus = status;

    if (status === 'completed') {
       // Atomic finalization
       if (volunteer.currentAssignment) {
          const mission = await Event.findById(volunteer.currentAssignment);
          if (mission) {
            // Log history
            const history = new MissionHistory({
              volunteerId: volunteer._id,
              missionId: mission._id,
              missionName: mission.title,
              status: 'completed',
              completedAt: new Date(),
            });
            await history.save();
          }
       }
       volunteer.currentAssignment = null;
       volunteer.assignmentStatus = 'unassigned';
       volunteer.missionsCompleted = (volunteer.missionsCompleted || 0) + 1;
       volunteer.currentLoad = Math.max(0, volunteer.currentLoad - 1);
    }

    await volunteer.save();
    res.json({ success: true, assignmentStatus: volunteer.assignmentStatus });
  } catch (error) {
    console.error('Update assignment status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// GET /api/volunteer/me/history - Paginated mission history
router.get('/me/history', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  try {
    const linkedId = req.impactUser.linkedVolunteerId;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const history = await MissionHistory.find({ volunteerId: linkedId })
      .sort({ completedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json(history);
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// GET /api/volunteer/me/notifications - Static for now, expand with realtime alerts
router.get('/me/notifications', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  res.json([]);
});

router.patch('/me/notifications/:id/read', checkRole('Volunteer', 'Administrator'), async (req, res) => {
  res.json({ success: true });
});

module.exports = router;
