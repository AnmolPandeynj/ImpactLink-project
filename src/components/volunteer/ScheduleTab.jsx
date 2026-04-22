import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { volunteerApi } from '../../services/volunteerApi';
import { Calendar, Save, Loader2, CheckCircle2 } from 'lucide-react';

export default function ScheduleTab() {
  const { appUser } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const times = ['morning', 'afternoon', 'night'];

  useEffect(() => {
    fetchProfile();
  }, [appUser]);

  const fetchProfile = async () => {
    try {
      const data = await volunteerApi.getProfile();
      if (data.availability && data.availability.monday) {
         setSchedule(data.availability);
      } else {
         // Initialize from scratch if missing
         const empty = {};
         days.forEach(d => {
           empty[d] = { morning: false, afternoon: false, night: false };
         });
         setSchedule(empty);
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (day, time) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [time]: !prev[day][time]
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await volunteerApi.updateProfile({ availability: schedule });
      setMessage('Schedule updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error updating schedule');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !schedule) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Schedule...</div>;
  }

  return (
    <div style={{ padding: '1.25rem', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Calendar size={24} color="var(--v-amber)" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>My Availability</h2>
      </div>

      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Update your standard weekly availability matrix. The allocation engine uses this to route missions to you when you are on shift.
      </p>

      {message && (
        <div style={{ padding: '0.75rem', background: 'rgba(52, 211, 153, 0.1)', color: '#10b981', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) 1fr 1fr 1fr', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-color)', padding: '0.75rem' }}>
          <div></div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Morn</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Aft</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Night</div>
        </div>

        {/* Rows */}
        {days.map(day => (
          <div key={day} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 1fr) 1fr 1fr 1fr', borderBottom: day !== 'sunday' ? '1px solid rgba(255,255,255,0.02)' : 'none', padding: '0.75rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', textTransform: 'capitalize' }}>
              {day.slice(0, 3)}
            </div>
            {times.map(time => (
              <div key={`${day}-${time}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <button
                  onClick={() => toggleSlot(day, time)}
                  style={{
                    width: '32px', height: '32px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: schedule[day][time] ? 'var(--v-amber)' : 'rgba(255,255,255,0.05)',
                    transition: 'background 0.2s'
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        disabled={saving}
        onClick={handleSave}
        style={{
          width: '100%', padding: '1rem', borderRadius: '8px', border: 'none',
          background: 'var(--primary)', color: '#fff', fontSize: '1rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1
        }}
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Save Schedule
      </button>
    </div>
  );
}
