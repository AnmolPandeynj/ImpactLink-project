import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function RequireRole({ role, children }) {
  const { firebaseUser, appUser, loading, error } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--primary)' }}>
        Loading Auth State...
      </div>
    );
  }

  // Not authenticated at all
  if (!firebaseUser) {
    return <Navigate to={`/auth?intent=${role === 'Volunteer' ? 'volunteer' : 'admin'}`} state={{ from: location }} replace />;
  }

  // Authenticated but waiting for Mongo User mapping to load
  if (!appUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)', color: '#fff', gap: '1rem' }}>
        {error ? (
          <>
            <div style={{ color: 'var(--error)', fontSize: '1.2rem', fontWeight: 600 }}>Sync Failed</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>{error}</div>
            <button 
              onClick={() => window.location.reload()}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' }}
            >
              Retry Connection
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--v-amber)', borderTopColor: 'transparent', borderRadius: '50%' }} />
            Synchronizing Profile...
          </>
        )}
      </div>
    );
  }

  // Mongo User exists, but role is null (needs to pick a role via setup)
  if (appUser.role === null) {
    return <Navigate to="/setup" replace />;
  }

  // Mongo User exists, but doesn't have the correct role for this route
  if (appUser.role !== role) {
    // Redirect them to their actual dashboard
    return <Navigate to={appUser.role === 'Administrator' ? '/dashboard' : '/volunteer'} replace />;
  }

  // User is authenticated and has the correct role
  return children;
}
