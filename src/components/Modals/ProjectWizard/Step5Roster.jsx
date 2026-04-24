import React, { useState, useEffect, useMemo } from 'react';
import { Users, MapPin, Plane, Award, CheckCircle2, Loader2, Sparkles, Star, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchVolunteers } from '../../../services/api';
import { calculateHaversineDistance } from '../../../services/logic';

const ExperienceBadge = ({ level }) => {
  const colors = {
    'Junior': { bg: 'rgba(255,255,255,0.05)', text: 'var(--text-dim)' },
    'Mid-Level': { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399' },
    'Senior': { bg: 'rgba(99, 102, 241, 0.1)', text: 'var(--accent-brand)' },
    'Elite': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' }
  };
  const theme = colors[level] || colors['Mid-Level'];
  return (
    <div style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: theme.bg, color: theme.text, fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>
      {level}
    </div>
  );
};

export default function Step5Roster({ data, update }) {
  const [volunteers, setVolunteers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0); // Region Index

  useEffect(() => {
    const loadData = async () => {
      try {
        const list = await fetchVolunteers();
        setVolunteers(list);
      } catch (err) {
        console.error('Failed to load roster:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const toggleVolunteer = (regionIdx, volunteerId, type) => {
    try {
      const currentRoster = [...(data?.assignedRoster || [])];
      const isSelected = currentRoster.some(r => r?.volunteerId === volunteerId && r?.regionIndex === regionIdx && r?.type === type);
      
      if (isSelected) {
        const updated = currentRoster.filter(r => !(String(r?.volunteerId) === String(volunteerId) && r?.regionIndex === regionIdx && r?.type === type));
        update('roster', { assignedRoster: updated });
      } else {
        // STRATEGIC: Strictly stringify IDs to prevent non-serializable objects from entering state
        update('roster', { assignedRoster: [...currentRoster, { volunteerId: String(volunteerId), regionIndex: Number(regionIdx), type: String(type) }] });
      }
    } catch (err) {
      console.error('[ROSTER] Toggle Failure:', err);
    }
  };

  const getFilteredVolunteers = (regionIdx, type) => {
    if (!volunteers || !volunteers.length) return [];
    
    // STRATEGIC: Prevent crash if regions are missing or index is out of bounds
    const region = data?.regions?.[regionIdx];
    const center = region?.center || { lat: 0, lng: 0 };
    const radius = region?.radius || 10000; // Default to global if no radius

    const { lat, lng } = center;

    // STRATEGIC: Show all active volunteers, but calculate proximity for context
    const list = volunteers
      .filter(v => v && v.status === 'Active')
      .map(v => {
        const vLat = v.locationId?.lat;
        const vLng = v.locationId?.lng;
        let distance = null;
        let isInRange = false;
        
        if (vLat && vLng && lat !== 0 && lng !== 0) {
          distance = calculateHaversineDistance(lat, lng, vLat, vLng);
          isInRange = distance <= radius;
        }

        return { ...v, distance, isInRange };
      });

    // TACTICAL: Sort by Proximity for Local, and by AI Match for both
    if (type === 'local') {
      return list.sort((a, b) => {
        if (a.isInRange && !b.isInRange) return -1;
        if (!a.isInRange && b.isInRange) return 1;
        return (a.distance || 9999) - (b.distance || 9999);
      });
    }
    
    return list;
  };

  const handleAutoDraft = async () => {
    try {
      setIsLoading(true);
      const missionContext = `${data.name}. ${data.description}. Focus: ${data.metadata.beneficiaryType}. Priority: ${data.metadata.priority}`;
      
      const res = await fetch('http://localhost:5000/api/allocate/semantic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Strategic: Identity Context
        },
        body: JSON.stringify({
          missionContext,
          volunteerIds: volunteers.map(v => v._id)
        })
      });

      if (!res.ok) throw new Error('Semantic allocation request failed.');
      
      const semanticMatches = await res.json();
      
      // Map scores back to volunteers
      const scoredVolunteers = volunteers.map(v => {
        const match = semanticMatches.find(m => m.volunteerId === v._id);
        return { ...v, semanticScore: match ? match.semanticScore : 0 };
      });

      setVolunteers(scoredVolunteers.sort((a, b) => (b.semanticScore || 0) - (a.semanticScore || 0)));

      // Optional: Auto-select Top 3 for current region?
      // For now, just let the user see the scores and decide, OR we can auto-toggle the best ones.
      
    } catch (err) {
      console.error('Auto-Draft Failure:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
       {data.allocationStrategy === 'ai' && (
         <div style={{ 
           padding: '1.5rem 2rem', 
           background: 'rgba(79, 70, 229, 0.05)', 
           border: '1px solid rgba(79, 70, 229, 0.2)', 
           borderRadius: '16px',
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'space-between',
           gap: '2rem'
         }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ 
                width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}>
                <Sparkles size={20} color="#fff" />
              </div>
              <div>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: 0 }}>AI-Augmented Allocation Active</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0 }}>
                  The engine will auto-draft top responders. Manual selections below act as **Tactical Overrides**.
                </p>
              </div>
           </div>
           
           <button 
             onClick={handleAutoDraft}
             disabled={isLoading}
             style={{ 
               padding: '0.75rem 1.25rem', background: 'var(--primary)', color: '#fff',
               border: 'none', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700,
               cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
               boxShadow: '0 4px 15px rgba(79, 70, 229, 0.3)'
             }}
           >
             <Zap size={14} /> {isLoading ? 'Analyzing Roster...' : 'Execute AI Auto-Draft'}
           </button>
         </div>
       )}

       {/* Region Navigation */}
       <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
         {data.regions.map((region, idx) => (
           <button
             key={idx}
             onClick={() => setActiveTab(idx)}
             style={{
               padding: '0.75rem 1.5rem', borderRadius: '12px', border: '1px solid',
               borderColor: activeTab === idx ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
               background: activeTab === idx ? 'rgba(79, 70, 229, 0.1)' : 'rgba(255,255,255,0.02)',
               color: activeTab === idx ? '#fff' : 'var(--text-dim)',
               cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
               display: 'flex', alignItems: 'center', gap: '0.6rem'
             }}
           >
             <MapPin size={14} /> {region.name || `Area ${idx + 1}`}
           </button>
         ))}
       </div>

       {/* Population Insight HUD */}
       {data.beneficiarySummary && (
         <motion.div 
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           style={{ 
             marginTop: '-1rem', marginBottom: '0rem', padding: '1rem 1.5rem', 
             background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.05), rgba(0,0,0,0.2))', 
             borderRadius: '16px', border: '1px solid rgba(79, 70, 229, 0.1)',
             display: 'flex', alignItems: 'center', justifyContent: 'space-between'
           }}
         >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color="var(--primary)" />
               </div>
               <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Target Impact Scope</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                     {data.beneficiarySummary.perZone?.find(z => z.zoneId === String(activeTab))?.count || 0} Beneficiaries <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 400 }}>in {data.regions[activeTab]?.name || `Area ${activeTab + 1}`}</span>
                   </div>
               </div>
            </div>

            <div style={{ textAlign: 'right' }}>
               <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase' }}>Total Population Served</div>
               <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                  {data.beneficiarySummary.totalCount || 0} Records
               </div>
            </div>
         </motion.div>
       )}

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          {/* LOCAL DRAFTBOARD */}
          <DraftSection 
            title="Resident Base Selection"
            icon={MapPin}
            type="local"
            color="var(--success)"
            target={data?.regions?.[activeTab]?.volunteerTargets?.local || 0}
            candidates={getFilteredVolunteers(activeTab, 'local')}
            selectedRoster={data?.assignedRoster || []}
            onToggle={(id) => toggleVolunteer(activeTab, id, 'local')}
            regionIdx={activeTab}
            isLoading={isLoading}
            data={data}
          />

          {/* TRAVEL DRAFTBOARD */}
          <DraftSection 
            title="Mobile Unit Selection"
            icon={Plane}
            type="travel"
            color="var(--accent-tertiary)"
            target={data?.regions?.[activeTab]?.volunteerTargets?.travel || 0}
            candidates={getFilteredVolunteers(activeTab, 'travel')}
            selectedRoster={data?.assignedRoster || []}
            onToggle={(id) => toggleVolunteer(activeTab, id, 'travel')}
            regionIdx={activeTab}
            isLoading={isLoading}
            data={data}
          />
       </div>
    </div>
  );
}

function DraftSection({ title, icon: Icon, type, color, target, candidates, selectedRoster, onToggle, regionIdx, isLoading, data }) {
  const selectedCount = selectedRoster.filter(r => r.regionIndex === regionIdx && r.type === type).length;
  const isOverQuota = selectedCount > target;
  const isTargetMet = selectedCount >= target && target > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
       <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
               <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <Icon size={18} color={color} />
               </div>
               <div>
                 <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</div>
                 <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                   Pool Density: <span style={{ color: '#fff', fontWeight: 600 }}>{candidates.length} Responders</span>
                 </div>
               </div>
            </div>
            <div style={{ 
              fontSize: '0.65rem', fontWeight: 800, padding: '0.3rem 0.6rem', borderRadius: '6px',
              background: isOverQuota ? 'rgba(251, 191, 36, 0.1)' : (isTargetMet ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)'),
              color: isOverQuota ? '#fbbf24' : (isTargetMet ? '#10b981' : 'var(--text-dim)'),
              border: '1px solid', borderColor: isOverQuota ? 'rgba(251, 191, 36, 0.2)' : (isTargetMet ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.1)')
            }}>
               {isOverQuota ? 'OVER QUOTA' : (isTargetMet ? 'TARGET MET' : 'DRAFTING')}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((selectedCount / (target || 1)) * 100, 100)}%` }}
                  style={{ height: '100%', background: color, borderRadius: '3px' }} 
                />
             </div>
             <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff', minWidth: '45px', textAlign: 'right' }}>
                {selectedCount} <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem', fontWeight: 500 }}>/ {target}</span>
             </div>
          </div>
       </div>

       <div style={{ 
         height: '500px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', 
         borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)',
         padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
       }}>
          {isLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Loader2 className="animate-spin" color="var(--primary)" />
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
               No available responders found for this criteria.
            </div>
          ) : (candidates || []).map(v => {
            if (!v || !v._id) return null;
            const isSelected = (selectedRoster || []).some(r => String(r?.volunteerId) === String(v._id) && Number(r?.regionIndex) === Number(regionIdx) && r?.type === type);
            const assignmentElsewhere = (selectedRoster || []).find(r => String(r?.volunteerId) === String(v._id) && (Number(r?.regionIndex) !== Number(regionIdx) || r?.type !== type));
            const isSelectedElsewhere = !!assignmentElsewhere;
            const assignedRegionName = isSelectedElsewhere ? (data?.regions?.[assignmentElsewhere.regionIndex]?.name || `Area ${Number(assignmentElsewhere.regionIndex) + 1}`) : null;
            
            return (
              <motion.div
                key={v._id}
                whileHover={{ scale: isSelectedElsewhere ? 1 : 1.01 }}
                onClick={() => !isSelectedElsewhere && onToggle(v._id)}
                style={{
                  padding: '1.25rem', background: isSelected ? 'rgba(79, 70, 229, 0.12)' : 'rgba(255,255,255,0.02)',
                  border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.05)',
                  boxShadow: isSelected ? '0 0 20px rgba(255, 255, 255, 0.15)' : 'none',
                  borderRadius: '16px', cursor: isSelectedElsewhere ? 'not-allowed' : 'pointer',
                  opacity: isSelectedElsewhere ? 0.4 : 1, transition: 'background 0.2s, box-shadow 0.2s, border 0.1s',
                  display: 'flex', flexDirection: 'column', gap: '1.25rem',
                  position: 'relative'
                }}
              >
                {isSelectedElsewhere && (
                  <div style={{ 
                    position: 'absolute', top: '0.75rem', right: '0.75rem', 
                    padding: '0.25rem 0.5rem', background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px',
                    fontSize: '0.55rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase'
                  }}>
                    Assigned: {assignedRegionName}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                        {(v.name || 'Unknown').split(' ').filter(Boolean).map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{v.name}</div>
                          {type === 'local' && v.isInRange && (
                            <div style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.55rem', fontWeight: 900 }}>LOCAL</div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 500, marginTop: '2px' }}>{v.skills.slice(0, 3).join(' • ')}</div>
                      </div>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {type === 'local' ? (
                      v.distance !== null && v.isInRange && (
                        <div style={{ textAlign: 'right', marginRight: '0.5rem' }}>
                          <div style={{ fontSize: '0.5rem', color: 'var(--text-dim)', fontWeight: 700 }}>DISTANCE</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>{v.distance.toFixed(1)} km</div>
                        </div>
                      )
                    ) : (
                      <div style={{ textAlign: 'right', marginRight: '0.75rem', minWidth: '100px' }}>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-dim)', fontWeight: 800, letterSpacing: '0.05em' }}>STATIONED</div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                          {v.locationId?.city ? `${v.locationId.city}, ${v.locationId.state || ''}` : (v.locationId?.name || 'Local Base')}
                        </div>
                      </div>
                    )}
                    {isSelected && (
                      <div style={{ 
                        width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 10px rgba(79, 70, 229, 0.5)'
                      }}>
                        <CheckCircle2 size={16} color="#fff" />
                      </div>
                    )}
                    
                    {/* STRATEGIC: Semantic Relevance Indicator */}
                    {v.semanticScore !== undefined && v.semanticScore > 0 && (
                      <div style={{ textAlign: 'right', minWidth: '50px' }}>
                          <div style={{ fontSize: '0.5rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Match</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 900, color: v.semanticScore > 0.8 ? '#10B981' : '#fff' }}>{Math.round(v.semanticScore * 100)}%</div>
                      </div>
                    )}
                 </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.75rem' }}>
                   <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                         <span>Performance Index</span>
                         <span style={{ color: '#fff' }}>{v.performanceScore}%</span>
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                        <div style={{ width: `${v.performanceScore}%`, height: '100%', background: 'var(--success)', borderRadius: '2px' }} />
                      </div>
                   </div>
                   <ExperienceBadge level={v.experienceLevel} />
                </div>

                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Zap size={10} color="#f59e0b" /> {v.missionsCompleted} Missions
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldCheck size={10} color="var(--success)" /> Verified
                   </div>
                </div>
              </motion.div>
            );
          })}
       </div>
    </div>
  );
}
