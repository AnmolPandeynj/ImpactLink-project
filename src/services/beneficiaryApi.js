import axios from 'axios';

const API_BASE = 'http://localhost:5000/api/beneficiary-datasets';

// Get auth token from localStorage
const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});

export const beneficiaryApi = {
  // Upload a new file
  uploadDataset: async (formData) => {
    const res = await axios.post(API_BASE, formData, {
      headers: {
        ...getAuthHeaders().headers,
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  // Get list of all datasets
  getDatasets: async () => {
    const res = await axios.get(API_BASE, getAuthHeaders());
    return res.data;
  },

  // Get preview and suggestions
  getPreview: async (id) => {
    const res = await axios.get(`${API_BASE}/${id}/preview`, getAuthHeaders());
    return res.data;
  },

  // Start processing (creation + geocoding)
  processDataset: async (id, columnMapping, projectId) => {
    const res = await axios.post(`${API_BASE}/${id}/process`, {
      columnMapping,
      projectId
    }, getAuthHeaders());
    return res.data;
  },

  // Get live processing status
  getStatus: async (id) => {
    const res = await axios.get(`${API_BASE}/${id}/status`, getAuthHeaders());
    return res.data;
  },

  // Get out-of-zone clusters for resolution
  getClusters: async (id) => {
    const res = await axios.get(`${API_BASE}/${id}/clusters`, getAuthHeaders());
    return res.data;
  },

  // Resolve out-of-zone clusters
  resolve: async (id, action, beneficiaryIds, zoneId, projectId) => {
    const res = await axios.post(`${API_BASE}/${id}/resolve`, {
      action,
      beneficiaryIds,
      zoneId,
      projectId
    }, getAuthHeaders());
    return res.data;
  }
};
