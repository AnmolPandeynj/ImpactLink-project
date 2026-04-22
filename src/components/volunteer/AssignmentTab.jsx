import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Navigation, Map as MapIcon, Compass } from 'lucide-react';
import AssignmentMap from './AssignmentMap';
import ResourceChecklist from './ResourceChecklist';
import StatusStepper from './StatusStepper';
import { useAssignment } from '../../hooks/useAssignment';

export default function AssignmentTab() {
  const { assignment, status, loading, acceptAssignment, updateStatus } = useAssignment();
  const [actionLoading, setActionLoading] = useState(false);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Mission Data...</div>;
  }

  if (!assignment || status === 'unassigned' || status === 'completed') {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <Compass size={48} color="rgba(255,255,255,0.1)" />
        <h2 style={{ color: 'var(--text-dim)', fontSize: '1.2rem', fontWeight: 500 }}>No Active Mission</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '300px' }}>Your command center will dispatch a mission here when you are needed.</p>
      </div>
    );
  }

  const handleStatusChange = async (newStatus) => {
    setActionLoading(true);
    try {
      if (newStatus === 'accepted') {
        await acceptAssignment();
      } else {
        await updateStatus(newStatus);
      }
    } catch (error) {
      console.error(error);
      alert('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Map Header - Fixed height */}
      <div style={{ height: '220px', width: '100%', position: 'relative', borderBottom: '1px solid var(--border-color)', backgroundColor: '#1a1a1a' }}>
        <AssignmentMap assignment={assignment} />
        
        {/* Overlay Details */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '1rem', background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: 'var(--error)', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem', letterSpacing: '1px' }}>
                SEVERITY {assignment.severity || 'HIGH'}
              </span>
              <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{assignment.title}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Mission Details Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Mission Briefing</h3>
          <p style={{ fontSize: '0.95rem', color: '#fff', lineHeight: 1.5 }}>
            {assignment.description || 'Proceed to the specified coordinates rendering immediate assistance as per standard operating protocols.'}
          </p>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
             <div>
               <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Location</div>
               <div style={{ fontSize: '0.85rem', color: '#fff' }}>{assignment.locationName || 'Unknown Sector'}</div>
             </div>
             <div>
               <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Required Type</div>
               <div style={{ fontSize: '0.85rem', color: '#fff' }}>{assignment.needType || 'General'}</div>
             </div>
          </div>
        </div>

        {/* Stepper Logic */}
        <StatusStepper status={status} onAction={handleStatusChange} loading={actionLoading} />

        {/* Dynamic Resource Checklist based on Status */}
        {status !== 'pending_accept' && (
          <ResourceChecklist assignment={assignment} />
        )}

      </div>
    </div>
  );
}
