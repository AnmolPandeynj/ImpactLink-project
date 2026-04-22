import React, { useState, useEffect } from 'react';
import { volunteerApi } from '../../services/volunteerApi';
import { Bell, Info } from 'lucide-react';

export default function AlertsTab() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await volunteerApi.getNotifications();
        setAlerts(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Alerts...</div>;

  return (
    <div style={{ padding: '1.25rem', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Bell size={24} color="var(--v-amber)" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Command Center Alerts</h2>
      </div>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
          <p>No new alerts.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {alerts.map((alert, index) => (
            <div key={index} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
               <Info size={20} color="#3b82f6" style={{ marginTop: '0.2rem' }} />
               <div>
                 <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{alert.message || alert}</p>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
