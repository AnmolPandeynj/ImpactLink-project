const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Volunteer = require('../models/Volunteer');

// POST /api/users/setup - Creates User doc, links volunteerCode to existing Volunteer
router.post('/setup', async (req, res) => {
  try {
    const { role, volunteerCode } = req.body;
    
    // We expect the user to be authenticated via Firebase
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let linkedVolunteerId = null;

    if (role === 'Volunteer' && volunteerCode) {
      // Find the volunteer by code (Assuming we added a volunteerCode field or just use a generic lookup for now)
      // For this implementation, we will look up by a hypothetical field or just create a new one for testing if not found
      // Actually the plan specifies: find Volunteer where volunteerCode === code
      const volunteer = await Volunteer.findOne({ volunteerCode: volunteerCode.toUpperCase() });
      if (volunteer) {
        linkedVolunteerId = volunteer._id;
        // Null out the code (single-use)
        volunteer.volunteerCode = null;
        await volunteer.save();
      } else {
        return res.status(400).json({ error: 'Invalid or expired volunteer code.' });
      }
    }

    // Upsert the User record
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { 
        uid: req.user.uid,
        email: req.user.email || 'unknown@example.com',
        displayName: req.user.name || '',
        role: role,
        linkedVolunteerId: linkedVolunteerId,
        onboardingComplete: true
      },
      { new: true, upsert: true }
    );

    res.json(user);
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to complete user setup.' });
  }
});

// GET /api/users/me - Returns full User doc
router.get('/me', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findOne({ uid: req.user.uid }).populate('linkedVolunteerId');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Fetch me error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// PATCH /api/users/me - Update User metadata (fcmToken, displayName)
router.patch('/me', async (req, res) => {
  try {
    if (!req.user || !req.user.uid) return res.status(401).json({ error: 'Unauthorized' });
    
    // Only allow specific fields
    const updates = {};
    if (req.body.fcmToken !== undefined) updates.fcmToken = req.body.fcmToken;
    if (req.body.displayName !== undefined) updates.displayName = req.body.displayName;
    
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: updates },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    console.error('Update me error:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

module.exports = router;
