import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';
import { Shield, Radar, ChevronRight, Key } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function RoleSelectionModal() {
  const { firebaseUser, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const intent = searchParams.get('intent') || '';
  
  const [selectedRole, setSelectedRole] = useState(
    intent === 'volunteer' ? 'Volunteer' : intent === 'admin' ? 'Administrator' : null
  );
  const [volunteerCode, setVolunteerCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSetup = async () => {
    if (!selectedRole) return;
    
    try {
      setLoading(true);
      setError('');
      
      const token = await firebaseUser.getIdToken();
      const HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      const res = await fetch(`${HOST}/api/users/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          role: selectedRole,
          volunteerCode: selectedRole === 'Volunteer' ? volunteerCode : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Setup failed');

      await refreshUser();
      
      if (selectedRole === 'Administrator') {
        navigate('/dashboard');
      } else {
        navigate('/volunteer');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-main)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ maxWidth: '600px', width: '100%', padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem', textAlign: 'center' }}>Choose Your Interface</h2>
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>Select your operational role to continue.</p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {/* Volunteer Card */}
          <div 
            onClick={() => setSelectedRole('Volunteer')}
            style={{ 
              flex: '1 1 250px', cursor: 'pointer', padding: '1.5rem', borderRadius: '12px',
              border: `2px solid ${selectedRole === 'Volunteer' ? '#F59E0B' : 'rgba(255,255,255,0.05)'}`,
              background: selectedRole === 'Volunteer' ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={24} color="#F59E0B" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Volunteer Portal</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Access field assignments, report statuses, and manage your availability schedule.</p>
          </div>

          {/* Admin Card */}
          <div 
            onClick={() => setSelectedRole('Administrator')}
            style={{ 
              flex: '1 1 250px', cursor: 'pointer', padding: '1.5rem', borderRadius: '12px',
              border: `2px solid ${selectedRole === 'Administrator' ? '#6366F1' : 'rgba(255,255,255,0.05)'}`,
              background: selectedRole === 'Administrator' ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <Radar size={24} color="#6366F1" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '0.5rem' }}>Command Center</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Manage large-scale incidents, track resources, and deploy strategic assets via AI.</p>
          </div>
        </div>

        {selectedRole === 'Volunteer' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Volunteer Code (Optional)</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 1rem' }}>
              <Key size={16} color="var(--text-dim)" />
              <input 
                type="text" 
                placeholder="e.g. HX72KP" 
                value={volunteerCode}
                onChange={e => setVolunteerCode(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ width: '100%', background: 'transparent', border: 'none', color: '#fff', padding: '0.75rem', outline: 'none', letterSpacing: '2px', textTransform: 'uppercase' }} 
              />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>If you were given a code by your coordinator, enter it here to link your profile.</p>
          </motion.div>
        )}

        {error && <div style={{ color: 'var(--error)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

        <button 
          onClick={handleSetup}
          disabled={!selectedRole || loading}
          style={{
            width: '100%', padding: '1rem', borderRadius: '8px', border: 'none',
            background: selectedRole ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
            color: '#fff', fontWeight: 600, fontSize: '1rem', cursor: selectedRole && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
          }}
        >
          {loading ? 'Configuring Profile...' : 'Complete Initialization'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
