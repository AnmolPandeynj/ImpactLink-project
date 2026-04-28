import { getAuthHeaders } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Fetch the volunteer profile linked to the current user.
 */
export const getMyVolunteerProfile = async () => {
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`);
  return res.json();
};

/**
 * Update the volunteer's availability/skills/details.
 * @param {Object} updates 
 */
export const updateMyProfile = async (updates) => {
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Profile update failed: ${res.status}`);
  return res.json();
};

/**
 * Update the status of the current assignment.
 * @param {string} status - 'accepted', 'en_route', 'on_site', 'completed'
 */
export const updateAssignmentStatus = async (status) => {
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me/assignment/status`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `Status update failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Fetch active assignments/mission details.
 */
export const getActiveAssignmentDetails = async (assignmentId) => {
  // In a real app, this might pull from a dedicated ResourceAllocation GET
  // For now, it's proxied through the user's dashboard view.
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me/assignment/${assignmentId}`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Assignment details failed: ${res.status}`);
  return res.json();
};

/**
 * Push the volunteer's current GPS coordinates to the backend.
 * Called on manual "Share Location" tap, and auto-called every 60s while en_route/on_site.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number|null} accuracy - metres, from browser Geolocation API
 */
export const shareMyLocation = async (lat, lng, accuracy = null) => {
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me/location`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ lat, lng, accuracy })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Location share failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Fetch the volunteer's current active mission (Event) for navigation rendering.
 * Returns { mission, volunteer } or { mission: null } when unassigned.
 * Kept separate from getMyVolunteerProfile to avoid inflating the 30s polling payload.
 */
export const getMyMission = async () => {
  const res = await fetch(`${API_BASE_URL}/api/volunteer/me/mission`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Mission fetch failed: ${res.status}`);
  return res.json();
};
