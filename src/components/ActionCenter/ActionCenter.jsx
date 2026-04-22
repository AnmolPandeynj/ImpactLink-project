import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, CheckCircle, Send, Users, MapPin, Sparkles, Zap, Shield, Clock } from 'lucide-react';
import { getMatchReasoning } from '../../services/gemini';
import { getPriorityLevel, getUrgencyDecay } from '../../services/logic';
import { getSkillMatchScore, getTopSkillMatch } from '../../services/skillMatrix';
import { calculateHaversineDistance } from '../../services/logic';
import { fetchVolunteers } from '../../services/api';

export default function ActionCenter({ incident, onDispatch }) {
  const [deployed, setDeployed] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [volunteers, setVolunteers] = useState(5);
  const [matchInsight, setMatchInsight] = useState('');
  const [liveResponders, setLiveResponders] = useState([]);
  const [loadingResponders, setLoadingResponders] = useState(true);

  const priorityInfo = useMemo(() => {
    const score = (incident.severity * 0.4 + (incident.frequency || 5) * 0.2 + incident.resourceGap * 0.3 + (incident.timeSensitivity || 5) * 0.1);
    return getPriorityLevel(score);
  }, [incident]);

  const decayFactor = useMemo(() => getUrgencyDecay(incident.createdAt), [incident.createdAt]);
  const isStale = decayFactor < 0.6;

  // Fetch live volunteer data from the DB
  useEffect(() => {
    async function loadResponders() {
      setLoadingResponders(true);
      try {
        const volData = await fetchVolunteers();
        setLiveResponders(volData);
      } catch (e) {
        console.warn('ActionCenter: Could not load live volunteers, falling back to empty list.', e);
        setLiveResponders([]);
      } finally {
        setLoadingResponders(false);
      }
    }
    loadResponders();
  }, []);

  // Score and rank responders using the allocation engine's logic:
  // Confidence = skill_match(40%) + proximity_bonus(30%) + performance(30%)
  const responders = useMemo(() => {
    if (!liveResponders.length || !incident.lat || !incident.lng) return [];

    return liveResponders
      .filter(v => v.status !== 'Inactive')
      .map(v => {
        const volLat = v.locationId?.lat ?? v.lat ?? 0;
        const volLng = v.locationId?.lng ?? v.lng ?? 0;
        const distanceKm = calculateHaversineDistance(volLat, volLng, incident.lat, incident.lng);

        const skillMatchScore = getSkillMatchScore(v.skills, incident.eventType || incident.needType);
        const proximityBonus = Math.max(0, 1 - (distanceKm / 500));
        const performance = (v.performanceScore || 85) / 100;

        // Composite confidence: skill(40%) + proximity(30%) + performance(30%)
        const confidence = (skillMatchScore * 0.40) + (proximityBonus * 0.30) + (performance * 0.30);

        const { skill: topSkill } = getTopSkillMatch(v.skills, incident.eventType || incident.needType);
        const passBadge = (v.responderType === 'mobile' || (v.travelRadius || 50) > 50) ? 'MOBILE' : 'RESIDENT';

        return {
          ...v,
          distanceKm,
          distanceVal: distanceKm, // legacy compat
          skillMatchScore,
          confidence: parseFloat(confidence.toFixed(3)),
          topSkill,
          passBadge,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }, [liveResponders, incident]);

  const topMatch = responders[0];

  useEffect(() => {
    if (topMatch && !deployed) {
      getMatchReasoning(topMatch, incident).then(setMatchInsight).catch(() => {});
    }
  }, [topMatch, incident, deployed]);

  const handleDeploy = () => {
    setDeploying(true);
    if (onDispatch) onDispatch(incident.id || incident._id, volunteers);
    setTimeout(() => {
      setDeploying(false);
      setDeployed(true);
    }, 1500);
  };

  return (
    <div style={{ paddingTop: '2rem', borderTop: '1px solid var(--border-subtle)', background: 'transparent' }}>
      <div className="pane-header" style={{ marginBottom: '1rem', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={14} color="var(--warning)" /> Action Center
        </span>
        {/* Urgency Decay Badge */}
        <span
          title={`Urgency decay factor: ${decayFactor}. Lower = older incident.`}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            fontSize: '0.625rem', fontFamily: 'monospace', textTransform: 'uppercase',
            padding: '0.2rem 0.5rem', borderRadius: '4px',
            background: isStale ? 'rgba(251, 146, 60, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: isStale ? 'var(--warning)' : 'var(--success)',
            border: `1px solid ${isStale ? 'rgba(251,146,60,0.3)' : 'rgba(16,185,129,0.2)'}`,
          }}
        >
          <Clock size={9} />
          {isStale ? `STALE · decay ${decayFactor}` : `FRESH · decay ${decayFactor}`}
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '1.5rem' }}>
        Orchestrate response from verified resource directory. {incident.needType || incident.eventType} skill priority is recommended.
      </p>

      {!deployed && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={10} /> Suggested Responders
            {loadingResponders && (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1 }}
                style={{ fontSize: '0.625rem', color: 'var(--text-dim)' }}
              >
                Loading live data...
              </motion.span>
            )}
          </div>

          {responders.length === 0 && !loadingResponders && (
            <div style={{ padding: '1rem', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px', fontSize: '0.8125rem', color: 'var(--error)' }}>
              No available responders found for this mission location. Consider running a full allocation pass.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {responders.map((r, idx) => (
              <div
                key={r._id || idx}
                style={{
                  padding: '0.75rem 1rem',
                  background: idx === 0 ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.03)',
                  borderRadius: '6px',
                  border: idx === 0 ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid var(--border-subtle)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.8125rem', color: '#fff', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {r.name}
                    {idx === 0 && (
                      <span style={{ fontSize: '0.625rem', background: '#38bdf8', color: '#000', padding: '0.1rem 0.3rem', borderRadius: '2px', fontWeight: 700 }}>
                        AI RECOMMENDATION
                      </span>
                    )}
                    {/* Pass 1/2 badge */}
                    <span style={{
                      fontSize: '0.5rem', padding: '0.1rem 0.3rem', borderRadius: '2px', fontWeight: 700,
                      background: r.passBadge === 'MOBILE' ? 'rgba(168,85,247,0.15)' : 'rgba(16,185,129,0.15)',
                      color: r.passBadge === 'MOBILE' ? '#a855f7' : 'var(--success)',
                      border: `1px solid ${r.passBadge === 'MOBILE' ? 'rgba(168,85,247,0.3)' : 'rgba(16,185,129,0.2)'}`,
                    }}>
                      {r.passBadge}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {r.topSkill} · {r.distanceKm.toFixed(1)} km
                    {/* Skill match score indicator */}
                    <span style={{ marginLeft: '0.5rem', color: r.skillMatchScore > 0.7 ? 'var(--success)' : r.skillMatchScore > 0.4 ? 'var(--warning)' : 'var(--text-dim)' }}>
                      · Skill {Math.round(r.skillMatchScore * 100)}%
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: idx === 0 ? '#38bdf8' : 'var(--success)', fontWeight: 600 }}>
                    {(r.confidence * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Match</div>
                </div>
              </div>
            ))}
          </div>

          {matchInsight && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.03)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '4px', display: 'flex', gap: '0.75rem' }}
            >
              <Sparkles size={14} color="#38bdf8" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: '1.4' }}>
                <span style={{ fontWeight: 600, color: '#38bdf8', fontStyle: 'normal', textTransform: 'uppercase', marginRight: '0.5rem' }}>Reasoning:</span>
                "{matchInsight}"
              </div>
            </motion.div>
          )}

          {/* Saturation Rate from DB */}
          {incident.saturationRate !== undefined && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>
                <span>Mission Saturation</span>
                <span>{Math.round((incident.saturationRate || 0) * 100)}%</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (incident.saturationRate || 0) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{
                    height: '100%', borderRadius: '2px',
                    background: (incident.saturationRate || 0) >= 0.6 ? 'var(--success)' : 'var(--warning)',
                  }}
                />
              </div>
              {incident.allocationStatus === 'critical_unmet' && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.625rem', color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Shield size={9} /> Critical Unmet — No mobile coverage found
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!deployed ? (
          <motion.div key="deploy-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Users size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="number"
                  value={volunteers}
                  onChange={(e) => setVolunteers(parseInt(e.target.value) || 1)}
                  min="1"
                  style={{
                    width: '100%', background: 'rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-subtle)', borderRadius: '4px',
                    padding: '0.5rem 1rem 0.5rem 2.5rem', color: '#fff',
                    fontFamily: 'monospace', fontSize: '0.875rem'
                  }}
                />
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Count</span>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}
              onClick={handleDeploy}
              disabled={deploying}
            >
              {deploying ? (
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }}>
                  Deploying...
                </motion.div>
              ) : (
                <><Send size={14} /> Dispatch Mission</>
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center', padding: '1rem' }}
          >
            <CheckCircle color="var(--success)" size={32} style={{ margin: '0 auto 1rem auto' }} />
            <h4 style={{ color: '#fff', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Personnel Dispatched</h4>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
              Mission protocol sent to {volunteers} nearby volunteers.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
