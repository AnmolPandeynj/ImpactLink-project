import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { volunteerApi } from '../../services/volunteerApi';
import { History, Award, Clock } from 'lucide-react';

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await volunteerApi.getHistory();
        setHistory(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading History...</div>;

  return (
    <div style={{ padding: '1.25rem', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <History size={24} color="var(--v-amber)" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Mission Log</h2>
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
          <p>No completed missions yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {history.map((record) => (
            <div key={record._id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{record.missionName || 'Strategic Mission'}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem' }}>
                     <Award size={12} /> COMPLETED
                  </div>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  <Clock size={14} /> 
                  <span>{new Date(record.completedAt).toLocaleDateString()}</span>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
