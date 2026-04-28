/**
 * ImpactLink Priority Scoring Engine (Deterministic Layer)
 *
 * Base formula (used for static display & strategic hub ranking):
 *   Priority Score = (Severity × 0.4) + (Frequency × 0.2) + (Gap × 0.3) + (Time × 0.1)
 *
 * Allocation formula (time-aware, used by the two-pass engine):
 *   urgency_decay = exp(-0.005 × hours_old)   // half-life ≈ 5.75 days
 *   adjusted = (raw × 0.7) + (raw × decay × 0.3)
 *
 * Inputs are 1-10 scales. Output is 1-10.
 */

const DECAY_LAMBDA = 0.005; // e^(-λt), half-life ≈ 138 hours (5.75 days)

/**
 * Compute how much urgency decay has occurred since creation.
 * Returns 1.0 for brand-new incidents, approaches 0.0 for very old ones.
 * @param {string|Date} createdAt
 * @returns {number} decay factor 0.0–1.0
 */
export const getUrgencyDecay = (createdAt) => {
  if (!createdAt) return 1.0;
  const hoursOld = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
  return parseFloat(Math.exp(-DECAY_LAMBDA * hoursOld).toFixed(4));
};

/**
 * Original flat-weight priority score (used for UI display, strategic hub ranking).
 * Does NOT apply time decay — used where stable ordering is preferred.
 */
export const calculatePriorityScore = (data) => {
  const {
    severity = 5,
    frequency = 5,
    resourceGap = 5,
    timeSensitivity = 5
  } = data;

  const score = (
    (severity * 0.4) +
    (frequency * 0.2) +
    (resourceGap * 0.3) +
    (timeSensitivity * 0.1)
  );

  return parseFloat(score.toFixed(2));
};

/**
 * Time-decayed priority score for allocation queue ordering.
 * Fresh incidents of equal severity outrank stale ones.
 * Formula: (raw × 0.7) + (raw × decay × 0.3)
 *
 * @param {object} data - { severity, frequency, resourceGap, timeSensitivity }
 * @param {string|Date} createdAt - Incident creation timestamp
 * @returns {number} Decayed score (same 1-10 scale, but time-modulated)
 */
export const calculateDecayedPriorityScore = (data, createdAt) => {
  const {
    severity = 5,
    frequency = 5,
    resourceGap = 5,
    timeSensitivity = 5,
  } = data;

  const rawScore = (
    (severity * 0.35) +
    (frequency * 0.175) +
    (resourceGap * 0.30) +
    (timeSensitivity * 0.125) +
    0.05  // small base to keep zero-input missions above zero
  );

  const decayFactor = getUrgencyDecay(createdAt);
  return parseFloat(((rawScore * 0.7) + (rawScore * decayFactor * 0.3)).toFixed(2));
};

export const calculateMisallocationScore = (incident) => {
  const { severity = 5, resourceGap = 5 } = incident;
  // High divergence between severity (need) and gap (misallocation depth)
  // Higher score = More critical misallocation hotspot
  const score = (severity * 0.6) + (resourceGap * 0.4);
  return parseFloat(score.toFixed(2));
};

export const getStrategicMissions = (incidents) => {
  const hubs = {};
  
  incidents.filter(inc => inc.allocationStatus !== 'saturated').forEach(inc => {
    const loc = inc.location || 'Unknown Area';
    if (!hubs[loc]) {
      hubs[loc] = { 
        id: `mission-${loc.replace(/\s+/g, '-').toLowerCase()}`,
        name: loc, 
        incidents: [],
        categories: {},
        avgSeverity: 0,
        avgGap: 0,
        lat: inc.lat,
        lng: inc.lng
      };
    }
    hubs[loc].incidents.push(inc);
    hubs[loc].categories[inc.eventType] = (hubs[loc].categories[inc.eventType] || 0) + 1;
  });

  return Object.values(hubs).map(hub => {
    const count = hub.incidents.length;
    const avgSeverity = hub.incidents.reduce((s, i) => s + i.severity, 0) / count;
    const avgGap = hub.incidents.reduce((s, i) => s + (i.resourceGap || 5), 0) / count;
    const avgPriority = hub.incidents.reduce((s, i) => s + calculatePriorityScore(i), 0) / count;
    
    // Advanced Strategic Algorithm: Intensity × Volume Multiplier
    // log10(count) provides diminishing returns on pure volume, but still significantly outranks single events.
    const volumeMultiplier = 1 + (Math.log10(count) * 0.85);
    const strategicPriority = avgPriority * volumeMultiplier;

    // Identify primary need
    const primaryNeed = Object.entries(hub.categories).sort((a,b) => b[1] - a[1])[0][0];

    return {
      ...hub,
      count,
      avgSeverity,
      avgGap,
      avgPriority,
      strategicPriority,
      primaryNeed,
      displayPriority: Math.min(10, strategicPriority) // Cap for UI progress bars
    };
  }).sort((a, b) => b.strategicPriority - a.strategicPriority);
};

export const getTopActiveHubs = (incidents) => {
  const hubs = getStrategicMissions(incidents);
  return hubs.slice(0, 8); 
};


export const getSectorHealthStatus = (incidents, locationName, volunteers = []) => {
  const sectorIncidents = incidents.filter(inc => inc.location === locationName);
  if (sectorIncidents.length === 0) return { label: 'STABLE', color: 'var(--success)', pulse: 0, percentage: 100 };
  
  const avgSeverity = sectorIncidents.reduce((s, i) => s + i.severity, 0) / sectorIncidents.length;
  const avgGap = sectorIncidents.reduce((s, i) => s + i.resourceGap, 0) / sectorIncidents.length;
  
  // Volunteer Density Impact: More local volunteers = Better health
  // Match by location name (fuzzy or direct)
  const localVolunteers = volunteers.filter(v => 
    v.locationId?.name === locationName || 
    locationName.includes(v.locationId?.name || '---')
  ).length;

  const responderBoost = Math.min(3, localVolunteers * 0.5); // Cap at +3 boost
  const rawStress = (avgSeverity * 0.6) + (avgGap * 0.4);
  const health = Math.min(10, Math.max(1, (10 - rawStress) + responderBoost));
  
  if (health < 4) return { label: 'CRITICAL', color: 'var(--error)', pulse: 1.2, percentage: health * 10 };
  if (health < 7) return { label: 'UNSTABLE', color: 'var(--warning)', pulse: 0.8, percentage: health * 10 };
  return { label: 'NOMINAL', color: 'var(--success)', pulse: 0.4, percentage: health * 10 };
};

export const getPriorityLevel = (score) => {
  if (score >= 8.5) return { label: 'CRITICAL', color: '#ef4444' };
  if (score >= 7.0) return { label: 'HIGH', color: '#f59e0b' };
  if (score >= 5.0) return { label: 'MEDIUM', color: '#38bdf8' };
  return { label: 'LOW', color: '#10b981' };
};

/**
 * STRATEGIC: Haversine Formula (Earth Curvature Aware)
 * Returns distance in kilometers between two GPS points.
 */
export const calculateHaversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};


