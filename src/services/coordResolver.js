/**
 * coordResolver.js — Frontend (ESM)
 *
 * Single source of truth for resolving a volunteer's coordinates.
 * Priority chain:
 *   1. liveLocation  — volunteer-reported GPS (if fresh within maxStaleHours)
 *   2. homeGeo       — v2 schema registered home coordinates
 *   3. locationId    — admin-assigned hub (populated ref object)
 *
 * Returns { lat, lng, source: 'gps'|'home'|'hub' } or null.
 * The `source` field lets consumers apply different visual/logic treatment:
 *   - 'gps'  → white dot on map (verified real position)
 *   - 'home' → green beacon (registered home)
 *   - 'hub'  → green beacon (admin-assigned hub estimate)
 */

/**
 * @param {Object} vol           - Volunteer object (locationId may be a populated object)
 * @param {number} maxStaleHours - How old liveLocation can be before falling back (default 12h)
 * @returns {{ lat: number, lng: number, source: string, staleHours?: number } | null}
 */
export function resolveVolunteerCoords(vol, maxStaleHours = 12) {
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

  return null;
}

/**
 * Returns a human-readable label for the coordinate source.
 */
export function getCoordSourceLabel(source) {
  return { gps: 'GPS', home: 'Home', hub: 'Hub' }[source] || 'Unknown';
}

/**
 * Formats lat/lng as a compact display string.
 * e.g. "22.72°N, 75.86°E"
 */
export function formatCoords(lat, lng) {
  if (lat == null || lng == null) return null;
  const latStr = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}
