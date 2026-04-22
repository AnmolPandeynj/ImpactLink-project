import React, { useEffect, useState } from 'react';
import { MapPin, Clock, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function HomeTab({ onNavigate, assignment, status }) {
  const { appUser } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  return (
    <div style={{ padding: '1rem', color: '#fff' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          {greeting}, {appUser?.displayName?.split(' ')[0] || 'Volunteer'}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
          Your impact dashboard is ready.
        </p>
      </div>

      {status !== 'unassigned' && status !== 'completed' && assignment ? (
        <div style={{ background: 'linear-gradient(145deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.02) 100%)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--v-amber)', boxShadow: '0 0 8px var(--v-amber)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--v-amber)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {status === 'pending_accept' ? 'Action Required' : 'Active Mission'}
            </span>
          </div>

          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>{assignment.title || 'Emergency Sector Assignment'}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              <MapPin size={14} />
              <span>{assignment.locationName || 'Sector 4 Coordination Hub'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              <Clock size={14} />
              <span>Dispatched {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>

          <button 
            onClick={() => onNavigate('assignment')}
            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: 'none', background: 'var(--v-amber)', color: '#000', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            {status === 'pending_accept' ? 'Review Assignment' : 'Open Mission Board'}
            <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', padding: '2rem 1rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 500 }}>No Active Assignments</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>You are currently on standby. Make sure your availability is up to date.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div 
          onClick={() => onNavigate('schedule')}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer' }}
        >
          <div style={{ color: '#6366f1' }}><Clock size={20} /></div>
          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Update Schedule</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Keep your availability current</div>
        </div>

        <div 
          onClick={() => onNavigate('profile')}
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', cursor: 'pointer' }}
        >
          <div style={{ color: '#10b981' }}><ShieldAlert size={20} /></div>
          <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Skill Profile</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manage certifications and vehicle</div>
        </div>
      </div>
    </div>
  );
}
