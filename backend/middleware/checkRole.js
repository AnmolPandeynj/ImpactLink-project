const User = require('../models/User');

const checkRole = (...allowedRoles) => async (req, res, next) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const user = await User.findOne({ uid: req.user.uid });
    
    // If no user document exists, or if role is null when not allowed
    if (!user) {
      return res.status(403).json({ error: 'User profile not found. Please complete setup.' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    req.impactUser = user;   // attach to request for downstream use
    next();
  } catch (err) {
    console.error('Role check failed:', err);
    res.status(500).json({ error: 'Role check failed' });
  }
};

module.exports = checkRole;
