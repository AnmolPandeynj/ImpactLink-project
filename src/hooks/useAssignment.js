import { useState, useEffect, useCallback, useRef } from 'react';
import { volunteerApi } from '../services/volunteerApi';
import { useAuth } from './useAuth';

export const useAssignment = () => {
  const { appUser } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [status, setStatus] = useState('unassigned');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Using ref for interval to clear it safely
  const intervalRef = useRef(null);

  const fetchAssignment = useCallback(async () => {
    if (!appUser || appUser.role !== 'Volunteer') return;
    try {
      setError(null);
      const data = await volunteerApi.getAssignment();
      setAssignment(data.assignment);
      setStatus(data.status);
    } catch (err) {
      setError(err.message);
    } finally {
      if (loading) setLoading(false);
    }
  }, [appUser, loading]);

  // Initial fetch and set interval
  useEffect(() => {
    if (appUser && appUser.role === 'Volunteer') {
      fetchAssignment();
      
      // Automatic 30-second polling for assignment availability
      intervalRef.current = setInterval(fetchAssignment, 30000);
      
      // Cleanup
      return () => clearInterval(intervalRef.current);
    } else {
      setLoading(false);
    }
  }, [appUser, fetchAssignment]);

  // Window Focus polling (immediately fetch when users returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      fetchAssignment();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAssignment]);

  const acceptAssignment = async () => {
    try {
      const res = await volunteerApi.acceptAssignment();
      setStatus(res.assignmentStatus);
      // Wait a moment before refreshing to ensure DB consistency
      setTimeout(fetchAssignment, 500);
      return res;
    } catch (err) {
      throw err;
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      const res = await volunteerApi.updateStatus(newStatus);
      setStatus(res.assignmentStatus);
      if (newStatus === 'completed') {
        setAssignment(null);
      }
      setTimeout(fetchAssignment, 500);
      return res;
    } catch (err) {
      throw err;
    }
  };

  return {
    assignment,
    status,
    loading,
    error,
    refresh: fetchAssignment,
    acceptAssignment,
    updateStatus
  };
};
