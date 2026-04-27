/**
 * coordResolver.js — Backend (CJS)
 *
 * Single source of truth for resolving a volunteer's coordinates.
 * Priority chain:
 *   1. liveLocation  — volunteer-reported GPS (if fresh within maxStaleHours)
 *   2. homeGeo       — v2 schema registered home coordinates
 *   3. locationId    — admin-assigned hub (populated Mongoose ref)
 *
 * Returns { lat, lng, source: 'gps'|'home'|'hub' } or null.
 * The `source` field lets consumers apply different visual/logic treatment.
 */

/**
 * @param {Object} vol         - Volunteer document (locationId may be populated)
 * @param {number} maxStaleHours - How old liveLocation can be before falling back (default 12h)
 * @returns {{ lat: number, lng: number, source: string, staleHours?: number } | null}
 */
function resolveVolunteerCoords(vol, maxStaleHours = 12) {
  if (!vol) return null;

  // 1. Live GPS — highest priority, but only if fresh enough
  const ll = vol.liveLocation;
  if (ll?.lat != null && ll?.lng != null) {
    const ageHours = ll.updatedAt
      ? (Date.now() - new Date(ll.updatedAt).getTime()) / 3600000
      : Infinity;
    if (ageHours <= maxStaleHours) {
      return { lat: ll.lat, lng: ll.lng, source: 'gps', staleHours: parseFloat(ageHours.toFixed(2)) };
    }
  }

  // 2. homeGeo — v2 schema home coordinates (may not be present in current DB)
  const hg = vol.homeGeo;
  if (hg?.lat != null && hg?.lng != null) {
    return { lat: hg.lat, lng: hg.lng, source: 'home' };
  }

  // 3. Hub location — populated locationId ref
  const loc = vol.locationId;
  if (loc?.lat != null && loc?.lng != null) {
    return { lat: loc.lat, lng: loc.lng, source: 'hub' };
  }

  // 4. Legacy root fallback (if frontend or old schema injected lat/lng directly)
  if (vol.lat != null && vol.lng != null) {
    return { lat: parseFloat(vol.lat), lng: parseFloat(vol.lng), source: 'legacy' };
  }

  return null;
}

module.exports = { resolveVolunteerCoords };
