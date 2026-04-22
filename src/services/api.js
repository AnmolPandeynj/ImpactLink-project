/**
 * ImpactLink API Service Layer
 * 
 * Centralizes all backend API calls. Every component should import from
 * this module instead of calling fetch() directly.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

import { auth } from './firebase';

/**
 * Get authorization headers using Firebase token
 */
const getAuthHeaders = async () => {
  try {
    const token = await auth?.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
};

// ─── Projects ───────────────────────────────────────────────
export const fetchProjects = async () => {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch projects: ${res.status}`);
  return res.json();
};

export const createProject = async (data) => {
  const res = await fetch(`${API_BASE_URL}/api/projects`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to create project: ${res.status}`);
  return res.json();
};

export const updateProject = async (id, data) => {
  const res = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to update project: ${res.status}`);
  return res.json();
};

export const deleteProject = async (id) => {
  const res = await fetch(`${API_BASE_URL}/api/projects/${id}`, {
    method: 'DELETE',
    headers: await getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete project: ${res.status}`);
  }
  return res.json();
};

// ─── Incidents ────────────────────────────────────────────
export const fetchIncidents = async (projectId = null) => {
  const url = projectId ? `${API_BASE_URL}/api/incidents?projectId=${projectId}` : `${API_BASE_URL}/api/incidents`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.status}`);
  return res.json();
};

export const createIncident = async (data) => {
  const res = await fetch(`${API_BASE_URL}/api/incidents`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create incident: ${res.status}`);
  }
  return res.json();
};

export const patchIncident = async (id, data) => {
  const res = await fetch(`${API_BASE_URL}/api/incidents/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to patch incident: ${res.status}`);
  return res.json();
};

// ─── Beneficiaries ────────────────────────────────────────
export const fetchBeneficiaries = async () => {
  const res = await fetch(`${API_BASE_URL}/api/beneficiaries`, {
    headers: await getAuthHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch beneficiaries: ${res.status}`);
  return res.json();
};

export const createBeneficiary = async (data) => {
  const res = await fetch(`${API_BASE_URL}/api/beneficiaries`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to create beneficiary: ${res.status}`);
  return res.json();
};

// ─── Volunteers ───────────────────────────────────────────
export const fetchVolunteers = async (projectId = null) => {
  const url = projectId ? `${API_BASE_URL}/api/volunteers?projectId=${projectId}` : `${API_BASE_URL}/api/volunteers`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch volunteers: ${res.status}`);
  return res.json();
};

// ─── Clusters / Analytics ─────────────────────────────────
export const fetchClusters = async (projectId = null) => {
  const url = projectId ? `${API_BASE_URL}/api/analytics/clusters?projectId=${projectId}` : `${API_BASE_URL}/api/analytics/clusters`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch clusters: ${res.status}`);
  return res.json();
};

// ─── Resource Hub (Logistics) ─────────────────────────────
export const fetchResourceHub = async (projectId = null) => {
  const url = projectId ? `${API_BASE_URL}/api/resource-hub?projectId=${projectId}` : `${API_BASE_URL}/api/resource-hub`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch resources: ${res.status}`);
  return res.json();
};

export const updateResource = async (id, data) => {
  const res = await fetch(`${API_BASE_URL}/api/resource-hub/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to update resource: ${res.status}`);
  return res.json();
};

// ─── Locations ────────────────────────────────────────────
export const fetchLocations = async () => {
  const res = await fetch(`${API_BASE_URL}/api/locations`);
  if (!res.ok) throw new Error(`Failed to fetch locations: ${res.status}`);
  return res.json();
};

// ─── Bulk Ingestion ───────────────────────────────────────
export const bulkIngest = async (data) => {
  const res = await fetch(`${API_BASE_URL}/api/ingestion/bulk`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Bulk ingestion failed: ${res.status}`);
  return res.json();
};

// ─── Two-Pass Allocation Engine ───────────────────────────────────────────

/**
 * Trigger a full two-pass resident + mobile allocation run.
 * Returns assignment results, dispatch list, and critical-unmet missions.
 * @param {string|null} projectId
 */
export const runAllocation = async (projectId = null) => {
  const url = projectId
    ? `${API_BASE_URL}/api/allocate?projectId=${projectId}`
    : `${API_BASE_URL}/api/allocate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Allocation failed: ${res.status}`);
  }
  return res.json();
};

/**
 * Get the latest allocation run result and running state.
 */
export const fetchAllocationStatus = async () => {
  const res = await fetch(`${API_BASE_URL}/api/allocation/status`);
  if (!res.ok) throw new Error(`Failed to fetch allocation status: ${res.status}`);
  return res.json();
};

/**
 * Get all missions that could not be covered by any mobile unit.
 */
export const fetchCriticalUnmet = async (projectId = null) => {
  const url = projectId
    ? `${API_BASE_URL}/api/allocation/critical-unmet?projectId=${projectId}`
    : `${API_BASE_URL}/api/allocation/critical-unmet`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch critical-unmet: ${res.status}`);
  return res.json();
};

/**
 * Force a re-run of the allocation engine (e.g. after a severity spike).
 * Resets critical_unmet missions back into the queue first.
 * @param {string|null} projectId
 */
export const rerunAllocation = async (projectId = null) => {
  const url = projectId
    ? `${API_BASE_URL}/api/allocation/rerun?projectId=${projectId}`
    : `${API_BASE_URL}/api/allocation/rerun`;
  const res = await fetch(url, {
    method: 'POST',
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Rerun failed: ${res.status}`);
  }
  return res.json();
};
