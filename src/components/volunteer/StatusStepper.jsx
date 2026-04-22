import React from 'react';
import { Loader2, Navigation, CheckCircle, AlertTriangle } from 'lucide-react';

export default function StatusStepper({ status, onAction, loading }) {
  
  // Define all possible steps
  const steps = [
    { id: 'pending_accept', label: 'Review', actionLabel: 'Accept Mission', color: 'var(--v-amber)', next: 'accepted' },
    { id: 'accepted', label: 'Accepted', actionLabel: 'Start Navigation', color: '#3b82f6', next: 'en_route' },
    { id: 'en_route', label: 'En Route', actionLabel: 'Arrived On Site', color: '#a855f7', next: 'on_site' },
    { id: 'on_site', label: 'On Site', actionLabel: 'Complete Mission', color: '#10b981', next: 'completed' }
  ];

  const currentIndex = steps.findIndex(s => s.id === status);
  if (currentIndex === -1 && status !== 'completed') return null; // Fallback

  if (status === 'completed') {
    return (
       <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
         <CheckCircle size={32} color="#10b981" style={{ margin: '0 auto 1rem' }} />
         <h3 style={{ color: '#10b981', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Mission Accomplished</h3>
         <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Awaiting new dispatch orders.</p>
       </div>
    );
  }

  const currentStepInfo = steps[currentIndex];

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
       {/* Visual Stepper */}
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', height: '2px', background: 'rgba(255,255,255,0.1)', zIndex: 0 }} />
          
          {steps.map((step, index) => {
             const isPast = index < currentIndex;
             const isActive = index === currentIndex;
             
             let bg = 'rgba(255,255,255,0.1)';
             let borderColor = 'transparent';
             let txtColor = 'var(--text-muted)';
             
             if (isActive) {
               bg = step.color;
               borderColor = step.color;
               txtColor = '#fff';
             } else if (isPast) {
               bg = 'var(--text-dim)';
               borderColor = 'var(--text-dim)';
               txtColor = 'var(--text-dim)';
             }

             return (
               <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 1 }}>
                 <div style={{ 
                   width: '22px', height: '22px', borderRadius: '50%', 
                   background: bg, border: `2px solid ${borderColor}`,
                   display: 'flex', alignItems: 'center', justifyContent: 'center'
                 }}>
                   {isPast && <CheckCircle size={12} color="#000" />}
                 </div>
                 <div style={{ fontSize: '0.65rem', color: txtColor, fontWeight: isActive ? 'bold' : 'normal', textTransform: 'uppercase' }}>
                   {step.label}
                 </div>
               </div>
             );
          })}
       </div>

       {/* Action Button */}
       <button
         disabled={loading}
         onClick={() => onAction(currentStepInfo.next)}
         style={{
           width: '100%', padding: '1rem', borderRadius: '8px', border: 'none',
           background: currentStepInfo.color, color: '#fff', fontSize: '1rem', fontWeight: 600,
           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
           cursor: loading ? 'not-allowed' : 'pointer',
           opacity: loading ? 0.7 : 1,
           boxShadow: `0 4px 14px ${currentStepInfo.color}40`,
           textShadow: '0 1px 2px rgba(0,0,0,0.5)'
         }}
       >
         {loading ? <Loader2 size={18} className="animate-spin" /> : currentStepInfo.actionLabel}
       </button>
    </div>
  );
}
