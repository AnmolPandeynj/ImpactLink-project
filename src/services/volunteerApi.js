import { auth } from './firebase';

const getAuthHeaders = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const volunteerApi = {
  getProfile: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetch profile');
    return res.json();
  },

  updateProfile: async (updates) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    return res.json();
  },

  getAssignment: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/assignment`, { headers });
    if (!res.ok) throw new Error('Failed to fetch assignment');
    return res.json();
  },

  acceptAssignment: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/assignment/accept`, {
      method: 'PATCH',
      headers
    });
    if (!res.ok) throw new Error('Failed to accept assignment');
    return res.json();
  },

  updateStatus: async (status) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/assignment/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  },

  getHistory: async (page = 1) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/history?page=${page}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  },

  getNotifications: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/notifications`, { headers });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  markNotificationRead: async (id) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${HOST}/api/volunteer/me/notifications/${id}/read`, {
      method: 'PATCH',
      headers
    });
    if (!res.ok) throw new Error('Failed to mark notification read');
    return res.json();
  }
};
