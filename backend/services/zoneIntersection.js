const { calculateHaversineDistance } = require('./logic');

/**
 * STRATEGIC: Zone Intersection Engine
 * Determines if a geographic point falls within any of the defined project zones.
 * 
 * @param {number} lat - Beneficiary Latitude
 * @param {number} lng - Beneficiary Longitude
 * @param {Array} zones - Project zones array [{ center: {lat, lng}, radius, name }]
 * @returns {object} { status, assignedZoneId, nearestZoneId, distance, overshoot }
 */
const resolveZoneAssignment = (lat, lng, zones = []) => {
  if (!lat || !lng || !zones.length) {
    return { status: 'missing_location' };
  }

  let nearestZone = null;
  let minDistance = Infinity;

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const distance = calculateHaversineDistance(lat, lng, zone.center.lat, zone.center.lng);
    
    // Check if within radius (MATCHED)
    if (distance <= zone.radius) {
      return {
        status: 'matched',
        assignedZoneId: String(i), // Store index as string for consistent lookup
        distanceFromNearestZoneKm: distance,
        overshootKm: 0
      };
    }

    // Track nearest for OUT_OF_ZONE resolution
    if (distance < minDistance) {
      minDistance = distance;
      nearestZone = { id: String(i), radius: zone.radius, distance };
    }
  }

  // If we're here, it's OUT_OF_ZONE
  return {
    status: 'out_of_zone',
    nearestZoneId: nearestZone.id,
    distanceFromNearestZoneKm: nearestZone.distance,
    overshootKm: nearestZone.distance - nearestZone.radius
  };
};

module.exports = { resolveZoneAssignment };
