import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, HandHeart, Phone, MapPin, Zap, ShieldCheck, Award, Star, TrendingUp, CheckCircle2, Clock, Calendar, Truck, Navigation, Activity } from 'lucide-react';
import { fetchLocations } from '../../services/api';

const ScoreCard = ({ label, value, icon: Icon, color, subValue }) => (
  <div style={{ 
    padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
    borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      <Icon size={12} color={color} /> {label}
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{value}</div>
      {subValue && <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{subValue}</div>}
    </div>
  </div>
);

const DetailPanel = ({ label, icon: Icon, children, style = {} }) => (
  <div style={{ 
    padding: '1.25rem', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', 
    borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem',
    ...style
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
      <Icon size={12} color="var(--primary)" /> {label}
    </div>
    {children}
  </div>
);

export default function VolunteerModal({ isOpen, onClose, initialData = null }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchLocations()
        .then(data => setLocations(data))
        .catch(err => console.error("Failed to fetch locations:", err));
    }
  }, [isOpen]);

  if (!isOpen || !initialData) return null;

  const experienceColors = {
    'Junior': '#94a3b8',
    'Mid-Level': 'var(--success)',
    'Senior': 'var(--accent-brand)',
    'Elite': '#f59e0b'
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '1600px', width: '95%', maxHeight: '92vh', border: '1px solid var(--border-subtle)', overflowY: 'auto', overflowX: 'hidden' }}
      >
        <div className="modal-header" style={{ padding: '2rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: 'rgba(99, 102, 241, 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              border: '1px solid var(--accent-brand)' 
            }}>
              <HandHeart size={24} color="var(--accent-brand)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>{initialData.name}</h2>
                <div style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: 'rgba(52, 211, 153, 0.1)', color: 'var(--success)', fontSize: '0.65rem', fontWeight: 800 }}>
                  {initialData.status.toUpperCase()}
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Operational Profile: {initialData._id}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Tactical Scorecard Section */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '1.25rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              <TrendingUp size={14} /> Tactical Performance Scorecard
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <ScoreCard label="Success Index" value={`${initialData.performanceScore}%`} icon={Zap} color="var(--warning)" />
              <ScoreCard label="Completion" value={`${initialData.completionRate}%`} icon={Activity} color="var(--success)" />
              <ScoreCard label="Missions" value={initialData.missionsCompleted} icon={ShieldCheck} color="var(--primary)" subValue={`${initialData.noShowCount} no-shows`} />
              <div style={{ 
                padding: '1rem', background: (experienceColors[initialData.experienceLevel] || '#94a3b8') + '10', 
                border: '1px solid ' + (experienceColors[initialData.experienceLevel] || '#94a3b8') + '30', 
                borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-dim)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Award size={12} color={experienceColors[initialData.experienceLevel] || '#94a3b8'} /> Experience Tier
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: experienceColors[initialData.experienceLevel] || '#94a3b8' }}>{initialData.experienceLevel}</div>
              </div>
            </div>
          </section>

          {/* Enhanced Grid Details - 3 Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
            {/* COLUMN 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <DetailPanel label="Capability Matrix" icon={Activity}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {initialData.skills?.map((skill, idx) => (
                    <div key={idx} style={{ padding: '0.4rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', fontSize: '0.75rem', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {skill}
                    </div>
                  ))}
                </div>
              </DetailPanel>

              <DetailPanel label="Active Deployment Context" icon={ShieldCheck} style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                   {initialData.projectIds?.length > 0 ? initialData.projectIds.map((proj, idx) => (
                     <div key={idx} style={{ 
                       padding: '0.75rem', background: 'rgba(99, 102, 241, 0.05)', 
                       border: '1px solid rgba(99, 102, 241, 0.1)', borderRadius: '8px',
                       fontSize: '0.8rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                     }}>
                       <span>{proj.name || 'Ongoing Relief Operation'}</span>
                       <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                     </div>
                   )) : (
                     <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                       Currently unassigned to active projects.
                     </div>
                   )}
                </div>
              </DetailPanel>
            </div>

            {/* COLUMN 2 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <DetailPanel label="Availability & Capacity" icon={Calendar} style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isAvailable = initialData.availability?.days?.includes(day);
                        return (
                          <div key={day} style={{ 
                            width: '2rem', height: '2rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
                            background: isAvailable ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.02)',
                            color: isAvailable ? 'var(--success)' : 'var(--text-muted)',
                            border: '1px solid', borderColor: isAvailable ? 'rgba(52, 211, 153, 0.2)' : 'transparent'
                          }}>
                            {day[0]}
                          </div>
                        );
                      })}
                   </div>
                   
                   <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                     <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Standard Shifts</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.8rem', fontWeight: 500 }}>
                        <Clock size={14} color="var(--primary)" /> {initialData.availability?.timeSlots?.join(' • ') || 'Flexible'}
                     </div>
                   </div>

                   <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                     <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Commitment Type</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.8rem', fontWeight: 500 }}>
                        <TrendingUp size={14} color="var(--primary)" /> {initialData.availability?.projectDuration || 'Standard'}
                     </div>
                   </div>
                </div>
              </DetailPanel>
            </div>

            {/* COLUMN 3 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
               <DetailPanel label="Mobility & Logistics" icon={Truck}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Navigation size={14} color="var(--primary)" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>Home Base: {initialData.locationId?.name || 'Central Hub'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Tactical Radius: {initialData.travelRadius}km</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asset</div>
                          <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{initialData.logistics?.vehicle}</div>
                       </div>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payload</div>
                          <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>{initialData.logistics?.supplyCapacity} kg</div>
                       </div>
                    </div>
                  </div>
               </DetailPanel>

               <div style={{ marginTop: 'auto', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-brand)', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    <Star size={12} fill="var(--accent-brand)" /> System Advisory
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
                    Responder is categorized as <strong style={{color:'#fff'}}>{initialData.experienceLevel}</strong> with a <strong style={{color:'#fff'}}>{initialData.completionRate}% completion rate</strong>. Priority routing is recommended for missions requiring high tactile precision.
                  </p>
               </div>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="btn btn-primary" 
            style={{ width: '100%', height: '3.5rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, marginTop: '1rem' }}
          >
            Close Responder Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
}
