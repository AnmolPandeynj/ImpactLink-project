import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Map as MapIcon, 
  Trophy, 
  TrendingUp, 
  ChevronRight,
  ShieldAlert,
  Users,
  MapPin,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Radio
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import useAssignment from '../../hooks/useAssignment';
import { shareMyLocation } from '../../services/volunteerApi';
import { formatCoords } from '../../services/coordResolver';

// ─── Auto-tracking statuses (operational accuracy when en route/on site) ─────
const AUTO_TRACK_STATUSES = ['en_route', 'on_site'];
const AUTO_TRACK_INTERVAL_MS = 60000; // 60 seconds

export default function HomeTab() {
  const { appUser } = useAuth();
  const { fullProfile } = useAssignment();

  // ── Location state ────────────────────────────────────────────────────────
  const [locationState, setLocationState] = useState('idle'); // idle | loading | success | error | denied
  const [lastShared, setLastShared] = useState(null);         // Date object
  const [locationError, setLocationError] = useState(null);
  const autoTrackRef = useRef(null);

  const assignedProjects = React.useMemo(() => {
    if (!fullProfile?.projectIds) return [];
    return [...fullProfile.projectIds].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
  }, [fullProfile]);

  // ── Seed lastShared from profile if available ────────────────────────────
  useEffect(() => {
    if (fullProfile?.liveLocation?.updatedAt) {
      setLastShared(new Date(fullProfile.liveLocation.updatedAt));
    }
  }, [fullProfile?.liveLocation?.updatedAt]);

  // ── Core GPS push function ───────────────────────────────────────────────
  const pushLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setLocationState('error');
        setLocationError('Geolocation not supported on this device.');
        reject(new Error('Geolocation unsupported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          try {
            await shareMyLocation(lat, lng, accuracy);
            setLastShared(new Date());
            setLocationState('success');
            setLocationError(null);
            resolve();
          } catch (err) {
            setLocationState('error');
            setLocationError(err.message);
            reject(err);
          }
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocationState('denied');
            setLocationError('Location access was denied. Please enable it in browser settings.');
          } else {
            setLocationState('error');
            setLocationError('Could not determine your position. Try again.');
          }
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, []);

  // ── Manual share handler ─────────────────────────────────────────────────
  const handleShareLocation = async () => {
    setLocationState('loading');
    try {
      await pushLocation();
    } catch {
      // errors handled inside pushLocation
    }
  };

  // ── Mission-aware auto-tracking ──────────────────────────────────────────
  const assignmentStatus = fullProfile?.assignmentStatus;
  const isAutoTracking = AUTO_TRACK_STATUSES.includes(assignmentStatus);

  useEffect(() => {
    if (isAutoTracking) {
      // Start interval
      autoTrackRef.current = setInterval(() => {
        pushLocation().catch(() => {}); // silent — don't disturb UX
      }, AUTO_TRACK_INTERVAL_MS);
    } else {
      clearInterval(autoTrackRef.current);
      autoTrackRef.current = null;
    }

    return () => clearInterval(autoTrackRef.current);
  }, [isAutoTracking, pushLocation]);

  // ── Relative time helper ─────────────────────────────────────────────────
  const relativeTime = (date) => {
    if (!date) return null;
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* High-Level Message */}
      <section>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
          Welcome back,
        </h2>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Strategic <span style={{ color: 'var(--v-amber, #F59E0B)' }}>Responder</span>
        </h1>
      </section>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <StatCard 
          icon={<TrendingUp size={20} color="#F59E0B" />} 
          label="Efficiency" 
          value="98.2%" 
          trend="+2.4%" 
        />
        <StatCard 
          icon={<Trophy size={20} color="#F59E0B" />} 
          label="Missions" 
          value={appUser?.linkedVolunteerId?.totalMissionsCompleted || 0} 
        />
      </div>

      {/* Location Share Card */}
      <LocationCard
        locationState={locationState}
        lastShared={lastShared}
        isAutoTracking={isAutoTracking}
        assignmentStatus={assignmentStatus}
        locationError={locationError}
        relativeTime={relativeTime}
        onShare={handleShareLocation}
        liveLocation={fullProfile?.liveLocation}
      />

      {/* Tactical Alerts */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Tactical Assignments</h3>
          <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
            {assignedProjects.length} Active
          </span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {assignedProjects.length > 0 ? (
            assignedProjects.map(project => {
              if (typeof project === 'string') return (
                <div key={project} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                  Mission ID: {project} (Loading details...)
                </div>
              );

              const assignmentEntry = project.assignedRoster?.find(r => 
                (r.volunteerId._id || r.volunteerId).toString() === (fullProfile?._id).toString()
              );
              const region = assignmentEntry && project.regions ? project.regions[assignmentEntry.regionIndex] : null;

              return (
                <AlertItem 
                  key={project._id}
                  type={project.metadata?.priority === 'Critical' || project.metadata?.priority === 'High' ? 'high' : 'info'}
                  title={project.name || `Mission ${project._id.slice(-6).toUpperCase()}`}
                  desc={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ opacity: 0.9, lineHeight: 1.5, fontSize: '0.85rem' }}>{project.description || 'Strategic response mission with priority coordination.'}</div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.25rem' }}>
                        {region && (
                          <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.4rem', 
                            color: 'var(--v-amber, #F59E0B)', fontSize: '0.7rem', 
                            fontWeight: 800, textTransform: 'uppercase'
                          }}>
                            <MapIcon size={12} /> {region.name || 'Primary Sector'}
                          </div>
                        )}
                        {project.metadata?.beneficiaryType && (
                          <div style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.4rem', 
                            color: 'var(--primary)', fontSize: '0.7rem', 
                            fontWeight: 800, textTransform: 'uppercase'
                          }}>
                            <Users size={12} /> {project.metadata.beneficiaryType}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {project.operatingMode === 'assisted' ? '🤖 AI-Assisted' : '🎮 Manual'}
                        </span>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          🛡️ {project.metadata?.approvalWorkflow || 'Standard'}
                        </span>
                        {project.timeline?.startDate && (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            📅 {new Date(project.timeline.startDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  }
                  time={project.metadata?.priority || 'Active'}
                />
              );
            })
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
              No specific mission deployments found. Scanning for regional gaps...
            </div>
          )}
        </div>
      </section>

      {/* Profile Card */}
      <div style={{ 
        padding: '1.5rem', background: '#111', borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.08)', display: 'flex',
        alignItems: 'center', gap: '1rem'
      }}>
        <div style={{ 
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'rgba(255,255,255,0.03)', display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <ShieldAlert size={28} color="var(--text-dim)" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontWeight: 700 }}>Operational Profile</h4>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>View your skills and ratings.</p>
        </div>
        <ChevronRight size={20} color="var(--text-dim)" />
      </div>
    </div>
  );
}

// ─── Location Card Component ───────────────────────────────────────────────────
function LocationCard({ locationState, lastShared, isAutoTracking, assignmentStatus, locationError, relativeTime, onShare, liveLocation }) {
  const hasLocation = liveLocation?.lat != null;
  const isLoading = locationState === 'loading';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: '1.25rem 1.5rem',
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${isAutoTracking ? 'rgba(245,158,11,0.25)' : hasLocation ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem'
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isAutoTracking ? (
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Radio size={16} color="#F59E0B" />
            </motion.div>
          ) : (
            <MapPin size={16} color={hasLocation ? '#10b981' : 'var(--text-dim)'} />
          )}
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
            {isAutoTracking ? 'Auto-Tracking Active' : 'Location Beacon'}
          </span>
        </div>

        {isAutoTracking && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, color: '#F59E0B',
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
            padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase'
          }}>
            {assignmentStatus === 'en_route' ? 'En Route' : 'On Site'}
          </span>
        )}
      </div>

      {/* Status / Coords */}
      {hasLocation ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
            <Navigation size={11} style={{ marginRight: '0.3rem', verticalAlign: 'middle' }} />
            {formatCoords(liveLocation.lat, liveLocation.lng)}
          </div>
          {lastShared && (
            <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
              Last shared {relativeTime(lastShared)}
              {liveLocation.accuracy && ` · ±${Math.round(liveLocation.accuracy)}m`}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Your position has not been shared yet.
        </div>
      )}

      {/* Error message */}
      {locationError && (locationState === 'error' || locationState === 'denied') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: '#ef4444' }}>
          <AlertCircle size={12} /> {locationError}
        </div>
      )}

      {/* Share button */}
      {!isAutoTracking && (
        <button
          onClick={onShare}
          disabled={isLoading}
          style={{
            width: '100%', padding: '0.75rem', borderRadius: '12px',
            background: isLoading ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B',
            fontSize: '0.8rem', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          {locationState === 'success' ? (
            <><CheckCircle2 size={14} /> Location Shared</>
          ) : isLoading ? (
            <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Navigation size={14} /></motion.div> Locating...</>
          ) : (
            <><MapPin size={14} /> Share My Location</>
          )}
        </button>
      )}

      {isAutoTracking && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textAlign: 'center' }}>
          Updating automatically every 60 seconds while on mission
        </div>
      )}
    </motion.div>
  );
}

function StatCard({ icon, label, value, trend }) {
  return (
    <div style={{ 
      padding: '1.25rem', background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        {icon}
        {trend && <span style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: 600 }}>{trend}</span>}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function AlertItem({ type, title, desc, time }) {
  return (
    <div style={{ 
      padding: '1rem', background: 'rgba(255,255,255,0.01)',
      borderLeft: `4px solid ${type === 'high' ? '#F59E0B' : '#6366F1'}`,
      borderRadius: '8px', display: 'flex', justifyContent: 'space-between'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', paddingLeft: '1rem' }}>{time}</div>
    </div>
  );
}
