import React, { useState, useEffect, useMemo } from 'react';
import { Users, MapPin, Plane, Award, X, ShieldAlert, Target, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchVolunteers } from '../../../services/api';
import { calculateHaversineDistance } from '../../../services/logic';

export default function Step4Personnel({ data, update }) {
  const [newSkill, setNewSkill] = useState('');
  const [volunteers, setVolunteers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadVolunteers = async () => {
      try {
        const list = await fetchVolunteers();
        setVolunteers(list);
      } catch (err) {
        console.error('Failed to load volunteer availability:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadVolunteers();
  }, []);

  /**
   * Spatial Analysis Engine
   * Calculates real-time availability based on region radius and volunteer GPS
   */
  const availabilityData = useMemo(() => {
    if (!volunteers.length) return { regions: {}, mobile: 0 };

    const regionCounts = {};
    let matchedVolunteers = new Set();

    // 1. Calculate Resident Base for each region
    // Priority chain mirrors coordResolver: liveLocation (GPS) → homeGeo → locationId (hub)
    data.regions.forEach((region, rIdx) => {
      const { lat, lng } = region.center;
      const radius = region.radius;
      
      const localResponders = volunteers.filter(v => {
        // 1. Live GPS — most accurate, prefer if available and recent (within 12h)
        const ll = v.liveLocation;
        if (ll?.lat != null && ll?.lng != null) {
          const ageHours = ll.updatedAt
            ? (Date.now() - new Date(ll.updatedAt).getTime()) / 3600000
            : Infinity;
          if (ageHours <= 12) {
            const dist = calculateHaversineDistance(lat, lng, ll.lat, ll.lng);
            const within = dist <= radius;
            if (within) matchedVolunteers.add(v._id);
            return within;
          }
        }

        // 2. homeGeo — registered home coordinates
        const hg = v.homeGeo;
        if (hg?.lat != null && hg?.lng != null) {
          const dist = calculateHaversineDistance(lat, lng, hg.lat, hg.lng);
          const within = dist <= radius;
          if (within) matchedVolunteers.add(v._id);
          return within;
        }

        // 3. locationId (admin-assigned hub)
        const vLat = v.locationId?.lat;
        const vLng = v.locationId?.lng;
        if (!vLat || !vLng) return false;
        const dist = calculateHaversineDistance(lat, lng, vLat, vLng);
        const within = dist <= radius;
        if (within) matchedVolunteers.add(v._id);
        return within;
      });

      regionCounts[rIdx] = localResponders.length;
    });

    // 2. Calculate Mobile Unit (volunteers outside all selected regions)
    const mobileResponders = volunteers.filter(v => !matchedVolunteers.has(v._id));

    return {
      regions: regionCounts,
      mobile: mobileResponders.length
    };
  }, [volunteers, data.regions]);

  const handleTargetChange = (regionIdx, field, value) => {
    let numValue = Math.max(0, parseInt(value) || 0);
    const newRegions = [...data.regions];
    const region = { ...newRegions[regionIdx] };
    if (!region.volunteerTargets) {
      region.volunteerTargets = { total: 0, local: 0, travel: 0 };
    }

    // 1. Capacity Monitoring (Warning only, not forced clamping)
    if (field === 'local') {
      const maxLocal = availabilityData.regions[regionIdx] || 0;
      // numValue = Math.min(numValue, maxLocal); // REMOVED RESTRICTION
    } else if (field === 'travel') {
      const totalMobileAvailable = availabilityData.mobile;
      const otherRegionsTravelTotal = data.regions.reduce((sum, r, idx) => {
        if (idx === regionIdx) return sum;
        return sum + (r.volunteerTargets?.travel || 0);
      }, 0);
      
      const headroom = Math.max(0, totalMobileAvailable - otherRegionsTravelTotal);
      // numValue = Math.min(numValue, headroom); // REMOVED RESTRICTION
    }

    const newTargets = { ...region.volunteerTargets, [field]: numValue };
    
    // Auto-sum correlation
    if (field === 'local' || field === 'travel') {
      newTargets.total = newTargets.local + newTargets.travel;
    } else if (field === 'total') {
      // If user edits total, we ensure it's at least the sum of local+travel
      newTargets.total = Math.max(numValue, newTargets.local + newTargets.travel);
    }

    region.volunteerTargets = newTargets;
    newRegions[regionIdx] = region;

    update('geography', { 
       regions: newRegions 
    });
  };

  // Calculate Shared Mobile Balance
  const totalAssignedMobile = useMemo(() => {
    return data.regions.reduce((sum, r) => sum + (r.volunteerTargets?.travel || 0), 0);
  }, [data.regions]);

  const remainingMobilePool = Math.max(0, availabilityData.mobile - totalAssignedMobile);

  const addSkill = () => {
    if (newSkill && !data.volunteerTargets.requiredSkills.includes(newSkill)) {
      update('personnel', {
        volunteerTargets: { 
          ...data.volunteerTargets, 
          requiredSkills: [...data.volunteerTargets.requiredSkills, newSkill] 
        }
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => {
    update('personnel', {
      volunteerTargets: { 
        ...data.volunteerTargets, 
        requiredSkills: data.volunteerTargets.requiredSkills.filter(s => s !== skill) 
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
      {/* Target Taskforce Metrics */}
      <section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Taskforce Target Metrics</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
               Define the scale of human capital required per operational zone. These numbers act as triggers for the AI allocation engine.
            </p>
          </div>

          {/* Allocation Strategy Selector */}
          <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', display: 'flex', gap: '2rem' }}>
            <div 
              onClick={() => update('personnel', { allocationStrategy: 'ai' })}
              style={{ 
                flex: 1, padding: '1.5rem', borderRadius: '12px', border: '1px solid', 
                borderColor: data.allocationStrategy === 'ai' ? '#10B981' : 'rgba(255,255,255,0.05)', 
                background: data.allocationStrategy === 'ai' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255,255,255,0.01)', 
                cursor: 'pointer', transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
                boxShadow: data.allocationStrategy === 'ai' ? '0 0 20px rgba(16, 185, 129, 0.1)' : 'none'
              }}
            >
              {data.allocationStrategy === 'ai' && (
                <div style={{
                  position: 'absolute', top: '0', right: '0',
                  background: '#10B981', color: '#fff', fontSize: '9px',
                  fontWeight: 900, padding: '4px 10px', borderRadius: '0 12px 0 12px',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  boxShadow: '-2px 2px 10px rgba(16, 185, 129, 0.2)'
                }}> Adaptive </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Sparkles size={18} color={data.allocationStrategy === 'ai' ? '#10B981' : 'var(--text-dim)'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>AI-Driven Optimization</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: 0 }}>Auto-select top-tier responders based on skill parity and proximity.</p>
            </div>

            <div 
              onClick={() => update('personnel', { allocationStrategy: 'manual' })}
              style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', border: '1px solid', borderColor: data.allocationStrategy === 'manual' ? 'var(--primary)' : 'rgba(255,255,255,0.05)', background: data.allocationStrategy === 'manual' ? 'rgba(79, 70, 229, 0.05)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <Users size={18} color={data.allocationStrategy === 'manual' ? 'var(--primary)' : 'var(--text-dim)'} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>Manual Tactical Drafting</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', margin: 0 }}>Review individual performance profiles and hand-pick your taskforce.</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {data.regions.map((region, idx) => (
              <div key={idx} style={{ 
                background: 'rgba(255,255,255,0.01)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '24px', 
                padding: '2rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={20} color="var(--primary)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                       <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff', margin: 0 }}>{region.name || `Operational Area ${idx + 1}`}</h4>
                       {isLoading ? (
                         <Loader2 size={12} className="animate-spin" color="var(--primary)" />
                       ) : (
                         <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '100px' }}>
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--success)' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)' }}>{availabilityData.regions[idx] || 0} Verifiable Responders</span>
                         </div>
                       )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>GPS Target: {region.center.lat.toFixed(4)}, {region.center.lng.toFixed(4)}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                  {[
                    { label: 'Total', field: 'total', icon: Users, color: 'var(--accent-brand)', desc: 'Absolute Target' },
                    { 
                      label: 'Local', 
                      field: 'local', 
                      icon: MapPin, 
                      color: 'var(--success)', 
                      desc: 'Resident Base',
                      availability: availabilityData.regions[idx] || 0
                    },
                    { 
                      label: 'Travel', 
                      field: 'travel', 
                      icon: Plane, 
                      color: 'var(--accent-tertiary)', 
                      desc: 'Mobile Unit',
                      availability: remainingMobilePool // Dynamic Shared Pool
                    }
                  ].map((item) => (
                    <div key={item.field} style={{ 
                      padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', 
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '16px', textAlign: 'center', transition: 'all 0.2s', position: 'relative',
                      boxShadow: (item.availability === 0 && item.field !== 'total') ? 'inset 0 0 40px rgba(239, 68, 68, 0.05)' : 'none'
                    }}>
                       {item.field !== 'total' && (
                         <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Sparkles size={10} color={item.availability > 0 ? 'var(--primary)' : 'var(--error)'} />
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: item.availability > 0 ? 'var(--text-dim)' : 'var(--error)' }}>
                               POOL: {item.availability}
                            </span>
                         </div>
                       )}
                       <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <item.icon size={20} color={item.color} />
                          </div>
                       </div>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input 
                            type="number" 
                            min="0"
                            value={region.volunteerTargets?.[item.field] || 0}
                            onChange={(e) => handleTargetChange(idx, item.field, e.target.value)}
                            readOnly={item.field === 'total'}
                            className="metric-input"
                            style={{ 
                              width: '100%', background: item.field === 'total' ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)', 
                              border: item.field === 'total' ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.1)', 
                              color: item.field === 'total' ? 'var(--accent-brand)' : '#fff', 
                              fontSize: '1.75rem', fontWeight: 800, textAlign: 'center', outline: 'none',
                              borderRadius: '8px', padding: '0.25rem 0', cursor: item.field === 'total' ? 'default' : 'pointer',
                              opacity: item.field === 'total' ? 0.8 : 1
                            }}
                          />
                          <div style={{ fontSize: '0.625rem', fontWeight: 700, color: (item.availability < (region.volunteerTargets?.[item.field] || 0) && item.field !== 'total') ? 'var(--error)' : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {item.desc} {(item.availability < (region.volunteerTargets?.[item.field] || 0) && item.field !== 'total') && ' (SHORTFALL)'}
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' }} />

      {/* Skills Matrix */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>Specialized Skills Matrix</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                 List any non-negotiable professional certifications or skills required for ground operations.
              </p>
            </div>
            
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="e.g. BLS Certification, Heavy Logistics, HINDI Speaking..."
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                style={{ 
                  width: '100%', padding: '1.1rem 5rem 1.1rem 1.25rem', background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid rgba(255,255,255,0.08)', color: '#fff', borderRadius: '12px', fontSize: '0.95rem' 
                }}
              />
              <button 
                onClick={addSkill} 
                style={{ 
                  position: 'absolute', right: '0.6rem', top: '0.6rem', bottom: '0.6rem',
                  padding: '0 1.25rem', background: 'var(--primary)', border: 'none',
                  color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem'
                }}
              >
                Add Pin
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <AnimatePresence>
                {data.volunteerTargets.requiredSkills.map(skill => (
                  <motion.div 
                    key={skill}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1rem', 
                      background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)', 
                      borderRadius: '100px', color: '#fff', fontSize: '0.8rem', fontWeight: 600 
                    }}
                  >
                    <Award size={14} color="var(--primary)" />
                    {skill}
                    <button onClick={() => removeSkill(skill)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {data.volunteerTargets.requiredSkills.length === 0 && (
                <div style={{ width: '100%', padding: '1.25rem', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                   No mandatory specializations defined. Generalist responders will be prioritized.
                </div>
              )}
            </div>
          </div>

          {/* Validation Checklist */}
          <div style={{ padding: '2rem', background: 'rgba(10, 15, 20, 0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
               <ShieldAlert size={20} color="var(--primary)" />
               <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personnel Guardrails</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {[
                { title: 'Database Query', desc: 'Sync with verified NGO responder registry' },
                { title: 'Skill Matching', desc: 'Auto-reject responders lacking core certifications' },
                { title: 'Availability Sync', desc: 'Validate responder windows vs mission timeline' }
              ].map((check, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem' }}>
                   <CheckCircle2 size={16} color="var(--success)" style={{ marginTop: '0.2rem' }} />
                   <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{check.title}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{check.desc}</div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
