import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Navigation, 
  Package, 
  PhoneCall, 
  ChevronRight, 
  CheckCircle2,
  Info,
  RefreshCw,
  Check,
  X
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, MarkerF } from '@react-google-maps/api';
import useAssignment from '../../hooks/useAssignment';
import { getMyMission } from '../../services/volunteerApi';
import { calculateHaversineDistance } from '../../services/logic';

const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'];
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] }
];

export default function AssignmentTab() {
  const { assignment, fullProfile, loading, error, updateStatus, refreshAssignment } = useAssignment();
  const [navData, setNavData] = useState({ mission: null, volunteer: null });
  const [navLoading, setNavLoading] = useState(false);
  const [directions, setDirections] = useState(null);
  const [routeError, setRouteError] = useState(false);
  const [routeStats, setRouteStats] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const fetchNavData = useCallback(async () => {
    if (!assignment?.id) return;
    setNavLoading(true);
    try {
      const data = await getMyMission();
      setNavData(data);
    } catch (err) {
      console.error('Failed to fetch nav data:', err);
    } finally {
      setNavLoading(false);
    }
  }, [assignment?.id]);

  useEffect(() => {
    fetchNavData();
  }, [fetchNavData]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAssignment();
    await fetchNavData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ── All hooks must be declared here, before ANY conditional return ──────────
  // (React Rules of Hooks: hooks must be called in the same order every render)

  const mission = navData?.mission ?? null;
  const volunteer = navData?.volunteer ?? null;

  const destCoords = useMemo(() => {
    if (!mission || mission.lat == null || mission.lng == null) return null;
    return { lat: mission.lat, lng: mission.lng };
  }, [mission]);

  const originCoords = useMemo(() => {
    if (!volunteer) return null;
    const ll = volunteer.liveLocation;
    if (ll && ll.lat != null && ll.lng != null) return { lat: ll.lat, lng: ll.lng };
    const hl = volunteer.hubLocation;
    if (hl && hl.lat != null && hl.lng != null) return { lat: hl.lat, lng: hl.lng };
    return null;
  }, [volunteer]);

  const directDistance = useMemo(() => {
    if (!originCoords || !destCoords) return null;
    return calculateHaversineDistance(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng).toFixed(1);
  }, [originCoords, destCoords]);

  useEffect(() => {
    if (isLoaded && originCoords && destCoords && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin: originCoords,
          destination: destCoords,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            setRouteError(false);
            if (result.routes[0]?.legs[0]) {
              setRouteStats({
                distance: result.routes[0].legs[0].distance.text,
                duration: result.routes[0].legs[0].duration.text
              });
            }
          } else {
            console.error(`Error fetching directions: ${status}`);
            setRouteError(true);
          }
        }
      );
    }
  }, [isLoaded, originCoords, destCoords]);

  // ── Conditional early returns (after all hooks) ──────────────────────────

  // State 1 & 2: No Assignment or Drafted
  if (!assignment || !assignment.id) {
    const latestProject = fullProfile?.projectIds?.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
    
    const loc = fullProfile?.liveLocation || fullProfile?.locationId || null;
    const mapCenter = loc && loc.lat ? { lat: loc.lat, lng: loc.lng } : { lat: 20, lng: 77 };

    if (latestProject) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* MAP AREA - System Standby */}
          <div style={{ height: '35vh', background: '#111', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            {isLoaded ? (
              <GoogleMap 
                mapContainerStyle={MAP_CONTAINER_STYLE} 
                center={mapCenter} 
                zoom={12} 
                options={{ styles: darkMapStyle, disableDefaultUI: true, gestureHandling: 'greedy' }}
              >
                {loc && loc.lat && (
                  <MarkerF position={{ lat: loc.lat, lng: loc.lng }} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#38bdf8", fillOpacity: 0.8, strokeColor: "#ffffff", strokeWeight: 2 }} />
                )}
              </GoogleMap>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Loading Map...</div>
            )}
            
            <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', zIndex: 10 }}>
               <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '1px' }}>SYSTEM STANDBY</span>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Tactical Readiness</h2>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>You are drafted into an active mission cluster.</p>
          </div>

          <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Primary Project</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{latestProject.name}</h3>
              </div>
              <div style={{ padding: '0.3rem 0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800 }}>DRAFTED</div>
            </div>
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
                  Scanning for high-priority missions... Keep the app open to receive alerts.
               </p>
            </div>
          </div>
          
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: isRefreshing ? 'wait' : 'pointer', fontWeight: 600, transition: 'all 0.2s', opacity: isRefreshing ? 0.7 : 1 }}
          >
             <RefreshCw size={18} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} /> {isRefreshing ? "Scanning..." : "Refresh Status"}
          </button>
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
          <MapPin size={32} color="var(--text-dim)" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>No Active Mission</h2>
        <p style={{ color: 'var(--text-dim)', lineHeight: 1.6 }}>We're scanning for local resource gaps.</p>
        <button 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1rem 2rem', background: 'rgba(255,255,255,0.05)', borderRadius: '100px', border: 'none', color: '#fff', margin: '2rem auto 0', cursor: isRefreshing ? 'wait' : 'pointer', opacity: isRefreshing ? 0.7 : 1 }}
        >
             <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} /> {isRefreshing ? "Scanning..." : "Refresh Status"}
        </button>
      </div>
    );
  }

  if (navLoading || !mission) {
     return <div className="p-4 text-dim">Loading tactical navigation data...</div>;
  }

  const isPending = volunteer?.assignmentStatus === 'pending_accept';



  const handleAccept = async () => {
    await updateStatus('accepted');
    fetchNavData();
  };

  const handleDecline = async () => {
    // In a real app, this might ping the allocation engine to re-assign
    // For now we'll just set it to unassigned on the frontend perspective 
    // (though backend might need a specific decline endpoint).
    alert("Mission declined. Please notify coordinator.");
  };

  const openGoogleMaps = () => {
    if (originCoords && destCoords) {
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${destCoords.lat},${destCoords.lng}&travelmode=driving`, '_blank');
    } else if (destCoords) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${destCoords.lat},${destCoords.lng}`, '_blank');
    }
  };

  // State 3: Pending Accept Gate
  if (isPending) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
           <div style={{ width: '40px', height: '40px', background: '#F59E0B', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
             <Navigation size={20} color="#000" />
           </div>
           <div>
             <h3 style={{ color: '#F59E0B', fontWeight: 800, margin: 0 }}>INCOMING MISSION</h3>
             <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Action required immediately</div>
           </div>
        </div>

        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{mission.eventType}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Location: {mission.locationName}</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
             <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>Severity: {mission.severity}/10</span>
             {directDistance && <span style={{ padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>{directDistance} km away</span>}
          </div>
        </div>

        <div style={{ height: '200px', background: '#111', borderRadius: '24px', overflow: 'hidden', position: 'relative' }}>
          {isLoaded && destCoords ? (
             <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE} center={destCoords} zoom={14} options={{ styles: darkMapStyle, disableDefaultUI: true }}>
               <MarkerF position={destCoords} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#ef4444", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 }} />
             </GoogleMap>
          ) : (
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Map loading...</div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={handleAccept} style={{ padding: '1.25rem', borderRadius: '16px', background: '#10B981', color: '#000', fontWeight: 800, fontSize: '1.1rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Check size={20} /> Accept & Navigate
          </button>
          <button onClick={handleDecline} style={{ padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <X size={18} /> Not Available
          </button>
        </div>
      </div>
    );
  }

  // State 4: Active Mission with Navigation
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* MAP AREA */}
      <div style={{ height: '45vh', background: '#111', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        {isLoaded ? (
          <GoogleMap 
            mapContainerStyle={MAP_CONTAINER_STYLE} 
            center={originCoords || destCoords || { lat: 0, lng: 0 }} 
            zoom={13} 
            options={{ styles: darkMapStyle, disableDefaultUI: true, gestureHandling: 'greedy' }}
          >
            {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true, polylineOptions: { strokeColor: '#38bdf8', strokeWeight: 5 } }} />}
            
            {originCoords && (
              <MarkerF position={originCoords} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#F59E0B", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 }} zIndex={2} />
            )}
            {destCoords && (
              <MarkerF position={destCoords} icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#ef4444", fillOpacity: 0.8, strokeColor: "#ffffff", strokeWeight: 2 }} zIndex={1} />
            )}
          </GoogleMap>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Loading Navigation Map...</div>
        )}

        {/* Floating ETA Overlay */}
        {(routeStats || directDistance) && (
          <div style={{ position: 'absolute', top: '1rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', padding: '0.6rem 1.25rem', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 10 }}>
            <Navigation size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
              {routeStats ? `ETA: ${routeStats.duration} • ${routeStats.distance}` : `${directDistance} km direct`}
            </span>
          </div>
        )}

        {/* Fallbacks */}
        {!originCoords && (
          <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: 'rgba(245, 158, 11, 0.9)', color: '#000', padding: '0.75rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, textAlign: 'center', zIndex: 10 }}>
             Share Location to enable navigation
          </div>
        )}
      </div>

      {/* MISSION META */}
      <div style={{ padding: '0 0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>{mission.eventType}</h1>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Location: {mission.locationName}</p>
          </div>
          <div style={{ padding: '0.4rem 0.8rem', background: '#F59E0B', color: '#000', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem' }}>
            SEV: {mission.severity}
          </div>
        </div>

        {routeError && originCoords && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '12px', fontSize: '0.8rem', marginBottom: '1rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            Route preview unavailable. Tap 'Open in Google Maps' below.
          </div>
        )}

        {/* Status Stepper */}
        <StatusStepper currentStatus={volunteer.status} onUpdate={updateStatus} />

        {/* Actions */}
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
           <button onClick={openGoogleMaps} style={{ width: '100%', padding: '1.25rem', borderRadius: '16px', background: '#38bdf8', color: '#000', fontWeight: 800, fontSize: '1rem', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
             <Navigation size={18} /> Open in Google Maps
           </button>
           
           <div style={{ display: 'flex', gap: '0.75rem' }}>
             <button style={{ flex: 1, padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <PhoneCall size={16} /> Contact
             </button>
             <button onClick={handleRefresh} style={{ flex: 1, padding: '1rem', borderRadius: '16px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <RefreshCw size={16} /> Refresh
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatusStepper({ currentStatus, onUpdate }) {
  const steps = [
    { id: 'accepted', label: 'Accepted', sub: 'Preparing for Dispatch' },
    { id: 'en_route', label: 'En Route', sub: 'Navigating to Sector' },
    { id: 'on_site', label: 'On Site', sub: 'Operational in Sector' },
    { id: 'completed', label: 'Finished', sub: 'Mission Logged' }
  ];

  const currentIndex = steps.findIndex(s => s.id === currentStatus);
  const displayIndex = Math.max(0, currentIndex); // Handle pending_accept which isn't in this list

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {steps.map((step, i) => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= displayIndex ? '#F59E0B' : 'rgba(255,255,255,0.1)', transition: 'all 0.5s ease' }} />
        ))}
      </div>
      
      <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)', padding: '1.25rem', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#F59E0B', fontWeight: 700, marginBottom: '0.25rem' }}>Current Status</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{steps[displayIndex]?.label || 'Pending'}</div>
        </div>
        
        {currentIndex >= 0 && currentIndex < steps.length - 1 && (
          <button onClick={() => onUpdate(steps[currentIndex + 1].id)} style={{ background: '#F59E0B', color: '#000', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Update <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
