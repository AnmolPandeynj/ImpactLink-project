import React from 'react';
import { motion } from 'framer-motion';
import { MoveRight, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';
import { getSectorHealthStatus, getTopActiveHubs } from '../../services/logic';

export default function RedeploymentStrategy({ incidents, volunteers, allocationResult }) {
  const activeHubs = getTopActiveHubs(incidents);
  
  const hubStatuses = activeHubs.map(h => ({
    name: h.name,
    ...getSectorHealthStatus(incidents, h.name, volunteers)
  }));

  const targets = hubStatuses.filter(s => s.label === 'CRITICAL' || s.label === 'UNSTABLE');
  const sources = hubStatuses.filter(s => s.label === 'NOMINAL' || s.label === 'STABLE');

  const shifts = targets.map((t, idx) => {
    if (sources.length === 0) return null;
    const s = sources[idx % sources.length];
    return { target: t, source: s };
  }).filter(Boolean);

  // Real data from allocation engine if available
  const allocationEfficiencyGain = allocationResult
    ? `${allocationResult.pass1?.assignments || 0} resident + ${allocationResult.pass2?.dispatches || 0} mobile dispatches`
    : null;
  const unmetCount = allocationResult?.pass2?.criticalUnmet || 0;

  return (
    <div className="pane" style={{ padding: '2rem', flex: 1, minHeight: '350px', background: 'var(--bg-pane)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingDown size={16} color="var(--success)" /> Lateral Redeployment Strategy
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Intelligence-led shifts</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {shifts.length > 0 ? (
          shifts.map((shift, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Source (Surplus)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle2 size={14} color="var(--success)" />
                  <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>{shift.source.name}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <MoveRight size={18} color="rgba(255,255,255,0.2)" />
                 <span style={{ fontSize: '0.5rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>MOVE</span>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target (Deficit)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <AlertCircle size={14} color="var(--error)" />
                  <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>{shift.target.name}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right', paddingLeft: '1rem', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                 <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>PRIORITIZE</div>
                 <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}>Reallocation</div>
              </div>
            </motion.div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-dim)', fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <CheckCircle2 size={20} color="var(--success)" />
            </div>
            System state balanced. No critical misallocations detected.
          </div>
        )}
      </div>

      {shifts.length > 0 && (
        <div style={{ marginTop: '2rem', padding: '1rem 1.5rem', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '8px' }}>
           <p style={{ fontSize: '0.75rem', color: 'rgba(56, 189, 248, 0.8)', lineHeight: '1.6', margin: 0 }}>
             <span style={{ fontWeight: 800 }}>ORCHESTRATION ADVISORY:</span>{' '}
             {allocationEfficiencyGain
               ? `Engine completed: ${allocationEfficiencyGain}. ${unmetCount > 0 ? `${unmetCount} mission(s) remain unmet — escalate to Strategic Missions panel.` : 'All gaps addressed.'}`
               : `AI detected a resource variance across ${shifts.length} key hubs. Initiating lateral shifts from stable zones will maximize volunteer impact without increasing logistical overhead.`
             }
           </p>
        </div>
      )}
    </div>
  );
}
