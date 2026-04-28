/**
 * ImpactLink Two-Pass Tactical Allocation Engine
 *
 * Architecture:
 *   Pass 1 (Deterministic) — Resident greedy assignment
 *     - Fixed-node responders assigned to missions within hub radius (20–50 km)
 *     - Score = skill_match_score × (1 / distance_km)
 *     - Greedy until maxLoad or 60% saturation threshold
 *     - Missions <60% saturation flagged as "open_gap" → feed Pass 2
 *
 *   Pass 2 (Probabilistic) — Mobile fleet dispatch
 *     - Only processes "open_gap" missions
 *     - Rank by Gap Delta: resource_gap × (1 - saturation_rate)
 *     - Score candidates: ETA(40%) + payload_fit(30%) + performance(30%)
 *     - Softmax selection over top-3 to prevent convoy clustering
 *     - Reserves 2nd/3rd candidate for fallback
 *
 * Edge cases:
 *   - Severity spike mid-Pass 2: re-scores + re-sorts queue
 *   - Zero mobile coverage: escalates to 'critical_unmet'
 *   - Resident overflow: one-step +30 km radius expansion
 *
 * Mutex: In-memory lock prevents concurrent allocation runs.
 * NEVER run Pass 1 and Pass 2 simultaneously — avoids double-assignment race conditions.
 */

const mongoose = require('mongoose');
const Event = require('../models/Event');
const Volunteer = require('../models/Volunteer');
const AuditLog = require('../models/AuditLog');
const { resolveVolunteerCoords } = require('./coordResolver');

// ─── Constants ───────────────────────────────────────────────────────────────

const SATURATION_THRESHOLD      = 0.60;  // 60%: Pass 1 → Pass 2 handoff
const RESIDENT_MAX_RADIUS_KM    = 50;    // Default resident hub radius
const MOBILE_MAX_RADIUS_KM      = 500;   // Mobile unit search radius
const RADIUS_EXPANSION_STEP_KM  = 30;    // Overflow expansion step
const SKILL_DECAY_LAMBDA        = 0.005; // Urgency decay rate (half-life ≈ 5.75 days)
const SOFTMAX_TEMPERATURE       = 0.5;   // Lower = sharper selection (less uniform)

// In-memory mutex to prevent concurrent runs
let allocationRunning = false;
let lastAllocationResult = null;

// ─── Haversine Distance ──────────────────────────────────────────────────────

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Skill Match Score (mirrors frontend skillMatrix.js) ─────────────────────

const SKILL_AFFINITY = {
  'Medical (Doctor)':       { Medical: 1.00, Food: 0.15, Water: 0.20, Infrastructure: 0.10, Shelter: 0.15, General: 0.50 },
  'First Aid':              { Medical: 0.80, Food: 0.10, Water: 0.15, Infrastructure: 0.05, Shelter: 0.20, General: 0.45 },
  'Counseling':             { Medical: 0.45, Food: 0.25, Water: 0.10, Infrastructure: 0.05, Shelter: 0.35, General: 0.50 },
  'Nursing':                { Medical: 0.90, Food: 0.15, Water: 0.20, Infrastructure: 0.05, Shelter: 0.20, General: 0.50 },
  'Logistics':              { Medical: 0.30, Food: 0.85, Water: 0.70, Infrastructure: 0.60, Shelter: 0.65, General: 0.60 },
  'Driving (Heavy Vehicles)':{ Medical: 0.25, Food: 0.80, Water: 0.75, Infrastructure: 0.65, Shelter: 0.70, General: 0.55 },
  'Water Sanitation':       { Medical: 0.35, Food: 0.40, Water: 1.00, Infrastructure: 0.45, Shelter: 0.25, General: 0.40 },
  'Technical Support':      { Medical: 0.15, Food: 0.20, Water: 0.40, Infrastructure: 0.85, Shelter: 0.55, General: 0.40 },
  'Search & Rescue':        { Medical: 0.60, Food: 0.20, Water: 0.30, Infrastructure: 0.40, Shelter: 0.50, General: 0.55 },
  'Community Outreach':     { Medical: 0.25, Food: 0.60, Water: 0.35, Infrastructure: 0.20, Shelter: 0.55, General: 0.65 },
  'Language Translation':   { Medical: 0.20, Food: 0.30, Water: 0.20, Infrastructure: 0.15, Shelter: 0.25, General: 0.55 },
};

const NEED_TYPE_ALIASES = {
  'medical shortage': 'Medical', 'medical': 'Medical', 'health': 'Medical', 'health check': 'Medical',
  'food': 'Food', 'food shortage': 'Food', 'relief delivery': 'Food',
  'water': 'Water', 'water contamination': 'Water', 'flood': 'Water',
  'infrastructure': 'Infrastructure', 'grid failure': 'Infrastructure', 'utility failure': 'Infrastructure',
  'structural collapse': 'Infrastructure',
  'shelter': 'Shelter', 'idp movement': 'Shelter', 'displacement': 'Shelter',
  'general': 'General',
};

function normalizeNeedType(raw) {
  if (!raw) return 'General';
  return NEED_TYPE_ALIASES[raw.toLowerCase().trim()] || 'General';
}

function getSkillMatchScore(skills, needType) {
  if (!skills || skills.length === 0) return 0.1;
  const canonical = normalizeNeedType(needType);
  let max = 0;
  for (const skill of skills) {
    const row = SKILL_AFFINITY[skill];
    if (!row) { max = Math.max(max, 0.15); continue; }
    max = Math.max(max, row[canonical] ?? 0.15);
  }
  return parseFloat(max.toFixed(3));
}

// ─── Urgency Decay ───────────────────────────────────────────────────────────

/**
 * Blended urgency decay: 70% raw score + 30% time-weighted raw score
 * λ = 0.005, half-life ≈ 5.75 days (138 hours)
 * Fresh sev-9 = 9.0, 7-day sev-9 ≈ 7.43, fresh sev-6 = 6.0
 */
function calculateDecayedPriorityScore(mission) {
  const { severity = 5, frequency = 5, resourceGap = 5, timeSensitivity = 5 } = mission;
  const eventTime = mission.eventTime || mission.createdAt || new Date();
  const hoursOld = Math.max(0, (Date.now() - new Date(eventTime).getTime()) / 3600000);
  const decayFactor = Math.exp(-SKILL_DECAY_LAMBDA * hoursOld);

  const rawScore = (severity * 0.35) + (frequency * 0.175) + (resourceGap * 0.30) + (timeSensitivity * 0.125) + 0.05;
  // Weighted blend: stable base + decay-modulated fraction
  return parseFloat(((rawScore * 0.7) + (rawScore * decayFactor * 0.3)).toFixed(3));
}

// ─── Softmax Selection ───────────────────────────────────────────────────────

/**
 * Weighted random selection using softmax probabilities.
 * Prevents convoy clustering by not always taking the top-scored unit.
 */
function softmaxSelect(candidates, τ = SOFTMAX_TEMPERATURE) {
  if (candidates.length === 1) return candidates[0];
  const maxScore = Math.max(...candidates.map(c => c.allocationScore));
  const expScores = candidates.map(c => Math.exp((c.allocationScore - maxScore) / τ));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  const probabilities = expScores.map(e => e / sumExp);

  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < candidates.length; i++) {
    cumulative += probabilities[i];
    if (rand <= cumulative) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ─── ETA Estimation ─────────────────────────────────────────────────────────

function estimateETA(volunteer, mission) {
  // Use shared resolver: liveLocation (GPS, if fresh) → homeGeo → locationId (hub)
  const coords = resolveVolunteerCoords(volunteer);
  if (!coords) return Infinity; // No coordinates → cannot estimate, treat as unreachable

  const distKm = haversineDistance(coords.lat, coords.lng, mission.lat, mission.lng);
  const speedKmH = {
    foot: 5, bike: 25, car: 60, truck: 45, helicopter: 200,
  }[volunteer.transportClass] || 50;
  return distKm / speedKmH; // hours
}

// ─── PASS 1: Resident Assignment ─────────────────────────────────────────────

async function runPass1_Resident(missions, residents) {
  const missionStates = new Map();
  const assignments = [];
  const volunteerLoad = new Map(residents.map(v => [String(v._id), 0]));

  // Initialize mission states
  for (const m of missions) {
    missionStates.set(String(m._id), {
      saturationRate: m.saturationRate || 0,
      resourceGapMet: m.resourceGapMet || 0,
      totalResourceGap: m.resourceGap || 5,
      assignedCount: (m.assignedResponders || []).length,
    });
  }

  // Group residents by hub, computing hub center from the average of member coords
  // This prevents the (0,0) Gulf of Guinea bug when locationId has no lat/lng.
  const hubGroups = new Map();
  for (const vol of residents) {
    const hubKey = String(vol.hubId || vol.locationId?._id || 'unknown');
    const coords = resolveVolunteerCoords(vol);
    
    if (!hubGroups.has(hubKey)) {
      hubGroups.set(hubKey, {
        hubId: hubKey,
        // Use locationId coords if valid, otherwise start at null — will be averaged from members
        lat: (vol.locationId?.lat && vol.locationId.lat !== 0) ? vol.locationId.lat : null,
        lng: (vol.locationId?.lng && vol.locationId.lng !== 0) ? vol.locationId.lng : null,
        radius: RESIDENT_MAX_RADIUS_KM,
        volunteers: [],
        _expandedOnce: false,
        _memberCoords: []
      });
    }
    const hub = hubGroups.get(hubKey);
    hub.volunteers.push(vol);
    // Collect resolved coords so we can compute a centroid if hub.lat is null
    if (coords) hub._memberCoords.push(coords);
  }

  // For hubs without valid lat/lng from the location ref, use the centroid of member coords
  for (const [, hub] of hubGroups) {
    if ((hub.lat == null || hub.lat === 0) && hub._memberCoords.length > 0) {
      hub.lat = hub._memberCoords.reduce((s, c) => s + c.lat, 0) / hub._memberCoords.length;
      hub.lng = hub._memberCoords.reduce((s, c) => s + c.lng, 0) / hub._memberCoords.length;
    }
  }

  for (const [, hub] of hubGroups) {
    // If hub center is still invalid (no volunteer has any coords), skip
    if (!hub.lat || !hub.lng) {
      console.warn(`[Allocation] Hub ${hub.hubId} has no resolvable coordinates — skipping.`);
      continue;
    }

    // Step 1: Find missions within hub radius
    let localMissions = missions.filter(m => {
      if (!m.lat || !m.lng) return false;
      return haversineDistance(hub.lat, hub.lng, m.lat, m.lng) <= hub.radius;
    });

    // Edge Case: Resident Overflow — no local missions, expand radius once (+30km)
    if (localMissions.length === 0 && hub.volunteers.length > 0 && !hub._expandedOnce) {
      hub._expandedOnce = true;
      const expandedRadius = hub.radius + RADIUS_EXPANSION_STEP_KM;
      localMissions = missions.filter(m => {
        if (!m.lat || !m.lng) return false;
        const dist = haversineDistance(hub.lat, hub.lng, m.lat, m.lng);
        return dist <= expandedRadius;
      });
    }

    if (localMissions.length === 0) continue;

    const availableVolunteers = hub.volunteers.filter(v => {
      const load = volunteerLoad.get(String(v._id)) ?? 0;
      return v.status !== 'Inactive' && load < (v.maxLoad || 3);
    });

    for (const vol of availableVolunteers) {
      const currentLoad = volunteerLoad.get(String(vol._id)) ?? 0;
      if (currentLoad >= (vol.maxLoad || 3)) continue;

      // Use volunteer's actual resolved coords for distance scoring if available
      const volCoords = resolveVolunteerCoords(vol);
      const scoringLat = volCoords?.lat ?? hub.lat;
      const scoringLng = volCoords?.lng ?? hub.lng;

      const scoredMissions = localMissions
        .filter(m => {
          const state = missionStates.get(String(m._id));
          return state && state.saturationRate < SATURATION_THRESHOLD;
        })
        .map(m => {
          const distKm = Math.max(0.1, haversineDistance(scoringLat, scoringLng, m.lat, m.lng));
          const skillMatch = getSkillMatchScore(vol.skills, m.eventType || m.needType);
          const proximityScore = 1 / distKm;
          const decayedPriority = calculateDecayedPriorityScore(m);
          return {
            mission: m,
            score: skillMatch * proximityScore * decayedPriority,
            distKm,
            skillMatch,
          };
        })
        .sort((a, b) => b.score - a.score);

      if (scoredMissions.length === 0) continue;

      const best = scoredMissions[0];
      const mId = String(best.mission._id);
      const state = missionStates.get(mId);

      assignments.push({
        volunteerId: vol._id,
        missionId: best.mission._id,
        pass: 1,
        skillMatchScore: best.skillMatch,
        distanceKm: best.distKm,
        score: best.score,
      });

      volunteerLoad.set(String(vol._id), currentLoad + 1);
      state.assignedCount += 1;
      const fillRate = 1 / Math.max(1, state.totalResourceGap);
      state.resourceGapMet = Math.min(1, state.resourceGapMet + fillRate);
      state.saturationRate = state.resourceGapMet;
      missionStates.set(mId, state);
    }
  }

  // Step 4: Flag open gaps (< 60% saturation)
  const openGaps = missions
    .filter(m => {
      const state = missionStates.get(String(m._id));
      return state && state.saturationRate < SATURATION_THRESHOLD;
    })
    .map(m => {
      const state = missionStates.get(String(m._id));
      const gapDelta = (m.resourceGap || 5) * (1 - (state?.saturationRate || 0));
      return { ...m, saturationRate: state?.saturationRate || 0, gapDelta };
    })
    .sort((a, b) => b.gapDelta - a.gapDelta);

  return { assignments, openGaps, missionStates };
}

// ─── PASS 2: Mobile Dispatch ──────────────────────────────────────────────────


/**
 * Probabilistic mobile fleet dispatch for open-gap missions.
 *
 * For each open gap (sorted by Gap Delta):
 *   1. Find mobile units within 500km with matching transport class
 *   2. Score: ETA(40%) + payload_fit(30%) + performance(30%)
 *   3. Softmax select from top-3 to prevent convoy clustering
 *   4. Dispatch #1, reserve #2/#3 for fallback
 *   5. If no mobiles found → escalate to 'critical_unmet'
 *
 * @param {Array} openGaps - Missions unsaturated after Pass 1
 * @param {Array} mobileUnits - Volunteers with responderType === 'mobile'
 * @returns {{ dispatches: Array, reserves: Array, criticalUnmet: Array }}
 */
async function runPass2_Mobile(openGaps, mobileUnits) {
  const dispatches = [];
  const reserves = [];
  const criticalUnmet = [];
  const mobileLoad = new Map(mobileUnits.map(v => [String(v._id), 0]));

  for (const gap of openGaps) {
    // Edge Case: Check if severity has spiked since we loaded data (real-time DB check)
    let currentGap = gap;
    try {
      const freshMission = await Event.findById(gap._id).lean();
      if (freshMission && freshMission.severity > gap.severity + 2) {
        // Severity spike detected — update and re-sort
        currentGap = {
          ...gap,
          severity: freshMission.severity,
          resourceGap: freshMission.resourceGap,
          gapDelta: freshMission.resourceGap * (1 - (gap.saturationRate || 0)),
        };
        openGaps.sort((a, b) => b.gapDelta - a.gapDelta); // Re-sort entire queue
      }
    } catch (e) {
      // DB read fail — continue with cached data
    }

    // Find eligible mobile candidates
    const candidates = mobileUnits
      .filter(v => {
        if (v.status === 'Inactive') return false;
        if ((mobileLoad.get(String(v._id)) ?? 0) >= (v.maxLoad || 3)) return false;

        const coords = resolveVolunteerCoords(v);
        if (!coords) return false;

        const distKm = haversineDistance(
          coords.lat,
          coords.lng,
          currentGap.lat,
          currentGap.lng
        );
        
        if (distKm > MOBILE_MAX_RADIUS_KM) return false;

        // Check transport feasibility for the distance
        const maxRangeByTransport = {
          foot: 10, bike: 80, car: 500, truck: 500, helicopter: 500,
        };
        const transportRange = maxRangeByTransport[v.transportClass] || 500;
        return distKm <= transportRange;
      })
      .map(v => {
        const coords = resolveVolunteerCoords(v);
        const distKm = haversineDistance(
          coords.lat,
          coords.lng,
          currentGap.lat,
          currentGap.lng
        );
        const etaHours = estimateETA(v, currentGap);
        const skillMatch = getSkillMatchScore(v.skills, currentGap.eventType || currentGap.needType);
        const payloadFit = Math.min(1, (v.logistics?.supplyCapacity || 0) / 100);
        const performance = (v.performanceScore || 85) / 100;

        // ETA score: closer to 0h is 1.0, at 24h+ → 0.0
        const etaScore = Math.max(0, 1 - (etaHours / 24));

        // Combined score: ETA(40%) + payload_fit(30%) + performance(30%)
        const allocationScore =
          (etaScore * 0.40) +
          (payloadFit * 0.30) +
          (performance * 0.30);

        // Boost by skill match (multiplicative modifier, not dominant)
        const finalScore = allocationScore * (0.5 + skillMatch * 0.5);

        return { ...v, distKm, etaHours, skillMatch, allocationScore: parseFloat(finalScore.toFixed(4)) };
      })
      .sort((a, b) => b.allocationScore - a.allocationScore);

    // Edge Case: Zero mobile coverage
    if (candidates.length === 0) {
      criticalUnmet.push({
        ...currentGap,
        escalationReason: `No mobile unit reachable within ${currentGap.urgencyWindow || 24}h urgency window`,
      });
      continue;
    }

    // Top-3 candidates for probabilistic selection
    const top3 = candidates.slice(0, 3);
    const selected = softmaxSelect(top3);
    const selectedId = String(selected._id);

    dispatches.push({
      volunteerId: selected._id,
      missionId: currentGap._id,
      pass: 2,
      etaHours: selected.etaHours,
      distanceKm: selected.distKm,
      allocationScore: selected.allocationScore,
      skillMatchScore: selected.skillMatch,
    });

    // Reserves: the remaining top-3 (not selected)
    const reserveCandidates = top3.filter(c => String(c._id) !== selectedId);
    for (const reserve of reserveCandidates) {
      reserves.push({
        volunteerId: reserve._id,
        missionId: currentGap._id,
        etaHours: reserve.etaHours,
        allocationScore: reserve.allocationScore,
        role: 'reserve',
      });
    }

    // Update mobile load
    mobileLoad.set(selectedId, (mobileLoad.get(selectedId) ?? 0) + 1);
  }

  return { dispatches, reserves, criticalUnmet };
}

// ─── Post-Allocation DB Writes ────────────────────────────────────────────────

async function persistAllocationResult(pass1Result, pass2Result, missionStates) {
  const bulkMissionOps = [];
  const bulkVolunteerOps = [];

  // Update missions with saturation rates and assigned responders
  for (const [missionId, state] of missionStates) {
    let status = 'unassigned';
    if (state.saturationRate >= SATURATION_THRESHOLD) status = 'partially_saturated';
    if (state.saturationRate >= 0.95) status = 'saturated';

    bulkMissionOps.push({
      updateOne: {
        filter: { _id: missionId },
        update: {
          $set: {
            allocationStatus: status,
            saturationRate: state.saturationRate,
            resourceGapMet: state.resourceGapMet,
            lastSeverityChange: new Date(),
          },
          $addToSet: {
            assignedResponders: {
              $each: [...pass1Result.assignments, ...pass2Result.dispatches]
                .filter(a => String(a.missionId) === missionId)
                .map(a => a.volunteerId),
            },
          },
        },
      },
    });
  }

  // Mark critical_unmet missions
  for (const unmet of pass2Result.criticalUnmet) {
    bulkMissionOps.push({
      updateOne: {
        filter: { _id: unmet._id },
        update: { $set: { allocationStatus: 'critical_unmet' } },
      },
    });
  }

  // Update volunteer currentLoad and set highest-priority mission as currentAssignmentId
  const loadMap = new Map();
  const allAssignments = [...pass1Result.assignments, ...pass2Result.dispatches];

  allAssignments.forEach(a => {
    const id = String(a.volunteerId);
    loadMap.set(id, (loadMap.get(id) || 0) + 1);
  });

  for (const [volId, load] of loadMap) {
    // Sort all assignments for this volunteer by score descending → pick the highest-priority mission
    // Pass 1 uses `score`, Pass 2 uses `allocationScore` — normalize with fallback to 0
    const topMission = allAssignments
      .filter(a => String(a.volunteerId) === volId)
      .sort((a, b) => (b.score || b.allocationScore || 0) - (a.score || a.allocationScore || 0))[0];

    bulkVolunteerOps.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(volId) },
        update: {
          $inc: { currentLoad: load },
          $set: {
            currentAssignmentId: new mongoose.Types.ObjectId(String(topMission.missionId)),
            assignmentStatus: 'pending_accept',
          },
        },
      },
    });
  }

  if (bulkMissionOps.length > 0) await Event.bulkWrite(bulkMissionOps);
  if (bulkVolunteerOps.length > 0) await Volunteer.bulkWrite(bulkVolunteerOps);
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Run the full two-pass allocation for a project.
 *
 * IMPORTANT: Never runs both passes simultaneously.
 * Pass 2 only starts after Pass 1 is fully complete.
 * In-memory mutex prevents concurrent runs.
 *
 * @param {string|null} projectId - MongoDB project ID, or null for global
 * @param {object} userId - Request user (for audit log)
 * @returns {AllocationResult}
 */
async function runAllocation(projectId, userId = null) {
  if (allocationRunning) {
    throw new Error('Allocation run already in progress. Please wait for the current run to complete.');
  }

  allocationRunning = true;
  const startTime = Date.now();

  try {
    // ── Auto-Generate Missions from Beneficiary Clusters ───────────────────
    if (projectId) {
      // Check if we need to auto-generate events for this project
      const existingEventsCount = await Event.countDocuments({ projectId });
      
      if (existingEventsCount === 0) {
        const Beneficiary = require('../models/Beneficiary');
        
        // Find beneficiaries with coordinates
        const beneficiaries = await Beneficiary.find({ 
          projectId, 
          'geo.lat': { $ne: null }, 
          'geo.lng': { $ne: null } 
        }).lean();

        if (beneficiaries.length > 0) {
          const { dbscan } = require('./clustering');
          const coords = beneficiaries.map(b => ({ lat: b.geo.lat, lng: b.geo.lng }));
          
          // Cluster beneficiaries into missions (eps: ~2km, min 3 points per cluster)
          const labels = dbscan(coords, 0.02, 3);
          
          const clustersMap = {};
          beneficiaries.forEach((b, i) => {
            const clusterId = labels[i];
            if (clusterId === -1) return; // ignore noise
            
            if (!clustersMap[clusterId]) {
              clustersMap[clusterId] = { lat: 0, lng: 0, count: 0, severity: 0, needs: {} };
            }
            const c = clustersMap[clusterId];
            c.lat += b.geo.lat;
            c.lng += b.geo.lng;
            c.count += 1;
            
            const sevScore = b.needSeverity === 'high' ? 9 : (b.needSeverity === 'medium' ? 6 : 3);
            c.severity += sevScore;
            
            const need = b.primaryNeed || 'General';
            c.needs[need] = (c.needs[need] || 0) + 1;
          });
          
          const newEvents = Object.values(clustersMap).map(c => {
            const primaryNeed = Object.keys(c.needs).reduce((a, b) => c.needs[a] > c.needs[b] ? a : b);
            const avgSeverity = Math.min(10, Math.round(c.severity / c.count));
            
            return {
              projectId,
              eventType: primaryNeed,
              severity: avgSeverity,
              resourceGap: Math.min(10, Math.max(1, Math.ceil(c.count / 5))),
              frequency: 5,
              timeSensitivity: avgSeverity,
              lat: c.lat / c.count,
              lng: c.lng / c.count,
              allocationStatus: 'unassigned',
              eventTime: new Date()
            };
          });
          
          if (newEvents.length > 0) {
            await Event.insertMany(newEvents);
            console.log(`[Allocation] Auto-generated ${newEvents.length} mission events from ${beneficiaries.length} beneficiaries.`);
          }
        }
      }
    }

    // ── Reset Stale Assignments ────────────────────────────────────────────
    // Clear previous allocation results for volunteers in this project scope
    // so assignments from a prior project/run don't bleed through.
    const staleVolunteerQuery = projectId
      ? { projectIds: projectId, assignmentStatus: { $ne: 'unassigned' } }
      : { assignmentStatus: { $ne: 'unassigned' } };
    
    const staleVolunteers = await Volunteer.find(staleVolunteerQuery, '_id currentAssignmentId').lean();
    
    if (staleVolunteers.length > 0) {
      // Only reset if their current assignment belongs to an event in THIS project scope
      // (prevents clearing a volunteer assigned to a different active project)
      const staleEventIds = staleVolunteers
        .map(v => v.currentAssignmentId)
        .filter(Boolean);
      
      const eventQuery2 = { _id: { $in: staleEventIds } };
      if (projectId) eventQuery2.projectId = projectId;
      
      const ownedEventIds = new Set(
        (await Event.find(eventQuery2, '_id').lean()).map(e => String(e._id))
      );
      
      const volunteerIdsToReset = staleVolunteers
        .filter(v => !v.currentAssignmentId || ownedEventIds.has(String(v.currentAssignmentId)))
        .map(v => v._id);
      
      if (volunteerIdsToReset.length > 0) {
        await Volunteer.updateMany(
          { _id: { $in: volunteerIdsToReset } },
          { $set: { currentAssignmentId: null, assignmentStatus: 'unassigned', currentLoad: 0 } }
        );
        console.log(`[Allocation] Reset ${volunteerIdsToReset.length} stale volunteer assignment(s) before fresh run.`);
      }
    }

    // ── Load Data ──────────────────────────────────────────────────────────
    const eventQuery = { allocationStatus: { $in: ['unassigned', 'partially_saturated', 'critical_unmet'] } };
    if (projectId) eventQuery.projectId = projectId;

    const [missions, allVolunteers] = await Promise.all([
      Event.find(eventQuery).lean(),
      Volunteer.find(
        projectId ? { projectIds: projectId, status: { $ne: 'Inactive' } } : { status: { $ne: 'Inactive' } }
      ).populate('locationId').lean(),
    ]);

    if (missions.length === 0) {
      return { 
        success: true, 
        message: 'No unassigned missions to allocate. Provide beneficiary data or manual events.', 
        assignments: [], 
        dispatches: [],
        pass1: { assignments: 0, openGaps: 0 },
        pass2: { dispatches: 0, reserves: 0, criticalUnmet: 0 },
        allocationEfficiency: 100,
        timestamp: new Date().toISOString()
      };
    }

    // Separate resident and mobile units
    const residents = allVolunteers.filter(v => v.responderType === 'resident' || (v.travelRadius || 50) <= 50);
    const mobileUnits = allVolunteers.filter(v => v.responderType === 'mobile' || (v.travelRadius || 50) > 50);

    // ── PASS 1: RESIDENT ASSIGNMENT (Must complete before Pass 2 starts) ──
    const pass1Result = await runPass1_Resident(missions, residents);

    // ── BARRIER: Pass 1 complete ──────────────────────────────────────────

    // ── PASS 2: MOBILE DISPATCH ───────────────────────────────────────────
    const pass2Result = await runPass2_Mobile(pass1Result.openGaps, mobileUnits);

    // ── PERSIST RESULTS ───────────────────────────────────────────────────
    await persistAllocationResult(pass1Result, pass2Result, pass1Result.missionStates);

    // ── AUDIT LOG ─────────────────────────────────────────────────────────
    try {
      await new AuditLog({
        userId: userId?.uid || 'SYSTEM',
        userEmail: userId?.email || 'system@impactlink',
        action: 'ALLOCATION_RUN',
        resource: 'AllocationEngine',
        ipAddress: 'internal',
      }).save();
    } catch (e) { /* Non-blocking */ }

    const result = {
      success: true,
      runDuration: Date.now() - startTime,
      totalMissions: missions.length,
      pass1: {
        assignments: pass1Result.assignments.length,
        openGaps: pass1Result.openGaps.length,
      },
      pass2: {
        dispatches: pass2Result.dispatches.length,
        reserves: pass2Result.reserves.length,
        criticalUnmet: pass2Result.criticalUnmet.length,
      },
      allocationEfficiency: missions.length > 0
        ? parseFloat((
            (missions.length - pass2Result.criticalUnmet.length) / missions.length * 100
          ).toFixed(1))
        : 100,
      assignments: pass1Result.assignments,
      dispatches: pass2Result.dispatches,
      reserves: pass2Result.reserves,
      criticalUnmet: pass2Result.criticalUnmet,
      timestamp: new Date().toISOString(),
    };

    lastAllocationResult = result;
    return result;

  } finally {
    allocationRunning = false;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  runAllocation,
  runPass1_Resident,
  runPass2_Mobile,
  haversineDistance,
  getSkillMatchScore,
  calculateDecayedPriorityScore,
  softmaxSelect,
  getLastAllocationResult: () => lastAllocationResult,
  isAllocationRunning: () => allocationRunning,
};
