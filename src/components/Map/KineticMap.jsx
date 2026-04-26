import React, { useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, OverlayViewF, MarkerClustererF, CircleF, MarkerF } from '@react-google-maps/api';
import { motion, AnimatePresence } from 'framer-motion';
import { mapStyles } from './mapStyles';
import { Plus, Minus } from 'lucide-react';

const containerStyle = {
  width: '100%',
  height: '500px',
  position: 'relative'
};

const CENTER_LAT = 20.5937;
const CENTER_LNG = 78.9629;
const HUB_POS = { lat: CENTER_LAT, lng: CENTER_LNG };

const MAP_OPTIONS = {
  styles: mapStyles,
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: false,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  backgroundColor: '#050505',
  gestureHandling: 'cooperative',
  restriction: {
    latLngBounds: {
      north: 38,
      south: 6,
      west: 67,
      east: 98,
    },
    strictBounds: false,
  },
};

const LIBRARIES = ['visualization'];

export default function KineticMap({ 
  isImmersive, 
  incidents, 
  selectedIncident, 
  activeDispatches, 
  clusters = { points: [], hotspots: [] },
  projectRegions = [] 
}) {
  const [vizMode, setVizMode] = React.useState('STRATEGIC');
  const [showNoise, setShowNoise] = React.useState(false);
  const [currentZoom, setCurrentZoom] = React.useState(5);
  const [mapRef, setMapRef] = React.useState(null);
  const [hoveredHotspot, setHoveredHotspot] = React.useState(null);

  const dynamicOptions = useMemo(() => ({
    ...MAP_OPTIONS,
    restriction: {
      latLngBounds: {
        north: 35.4,
        south: 8.0,
        west: 68.7,
        east: 97.2,
      },
      strictBounds: true,
    },
    minZoom: isImmersive ? 5.5 : 4.5,
  }), [isImmersive]);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: ['visualization', 'places']
  });

  // 1. SMART ADAPTIVE RADIUS (Non-linear for analytical clarity)
  const adaptiveRadius = useMemo(() => {
    // Zoom 4-5: 12-14px (tight)
    // Zoom 10: ~30px
    // Zoom 15+: ~60px
    const radius = Math.max(10, (currentZoom * 4.5) - 10);
    return Math.round(radius);
  }, [currentZoom]);

  // 2. DYNAMIC MAX INTENSITY
  // Prevents 'White-out' when many clusters are visible
  const maxIntensity = useMemo(() => {
    const base = Math.log(incidents.length + 1) * 1.8;
    // Lower zoom needs higher intensity threshold to avoid merging
    const zoomComp = Math.max(1, 12 - currentZoom);
    return base + zoomComp;
  }, [incidents.length, currentZoom]);

  // 3. ENHANCED OPTIONS
  const heatmapOptions = useMemo(() => ({
    radius: adaptiveRadius,
    opacity: 0.8,
    dissipating: true,
    maxIntensity: maxIntensity,
    gradient: [
      'rgba(0, 0, 0, 0)',
      'rgba(16, 185, 129, 0.4)',
      'rgba(16, 185, 129, 0.7)',
      'rgba(250, 204, 21, 0.6)',
      'rgba(251, 146, 60, 0.8)',
      'rgba(249, 115, 22, 0.9)',
      'rgba(239, 68, 68, 0.9)',
      'rgba(220, 38, 38, 1)',
      'rgba(185, 28, 28, 1)',
    ]
  }), [adaptiveRadius, maxIntensity]);

  // 4. SMART WEIGHT COMPUTATION
  const heatmapPoints = useMemo(() => {
    if (!isLoaded || !window.google?.maps?.LatLng) return []; 
    return incidents.map(inc => {
      // SMART BINDING: Support both flat and nested (V2) geo formats
      const lat = parseFloat(inc.geo?.lat || inc.lat);
      const lng = parseFloat(inc.geo?.lng || inc.lng);
      if (isNaN(lat) || isNaN(lng)) return null;

      // Urgency and Socio-Economic impact drive the "Glow"
      const urgencyWeight = (
        (inc.calculatedUrgency || inc.severity || 5) * 0.7 + 
        (inc.impactPotential || 5) * 0.3
      );
      
      try {
        return {
          location: new window.google.maps.LatLng(lat, lng),
          weight: Math.max(1, urgencyWeight)
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  }, [incidents, isLoaded]);

  // 5. REF FOR NATIVE LAYER
  const heatmapLayerRef = React.useRef(null);

  // 6. NATIVE LAYER EFFECT
  React.useEffect(() => {
    if (!isLoaded || !mapRef || !window.google?.maps?.visualization?.HeatmapLayer) return;

    if (!heatmapLayerRef.current) {
      try {
        heatmapLayerRef.current = new window.google.maps.visualization.HeatmapLayer({
          map: null,
          ...heatmapOptions
        });
      } catch (e) {
        console.error("Heatmap Layer Init Failed:", e);
        return;
      }
    }

    const layer = heatmapLayerRef.current;
    if (vizMode === 'HEATMAP' && heatmapPoints.length > 0) {
      layer.setData(heatmapPoints);
      layer.setOptions(heatmapOptions);
      if (layer.getMap() !== mapRef) layer.setMap(mapRef);
    } else {
      if (layer.getMap() !== null) layer.setMap(null);
    }
  }, [vizMode, heatmapPoints, heatmapOptions, isLoaded, mapRef]);

  // FINAL CLEANUP
  React.useEffect(() => {
    return () => {
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.setMap(null);
        heatmapLayerRef.current = null;
      }
    };
  }, []);

  // 7. SMART CENTERING (Auto-fit to dataset)
  React.useEffect(() => {
    if (mapRef && incidents.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidPoints = false;
      
      incidents.forEach(inc => {
        const lat = parseFloat(inc.geo?.lat || inc.lat);
        const lng = parseFloat(inc.geo?.lng || inc.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          bounds.extend({ lat, lng });
          hasValidPoints = true;
        }
      });

      if (hasValidPoints) {
        mapRef.fitBounds(bounds);
        // Don't zoom in too much for single points
        if (mapRef.getZoom() > 15) mapRef.setZoom(15);
      }
    }
  }, [incidents, mapRef]);

  React.useEffect(() => {
    if (mapRef && selectedIncident) {
      const lat = parseFloat(selectedIncident.geo?.lat || selectedIncident.lat);
      const lng = parseFloat(selectedIncident.geo?.lng || selectedIncident.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        mapRef.panTo({ lat, lng });
        mapRef.setZoom(13);
      }
    }
  }, [selectedIncident, mapRef]);

  const handleZoomIn = useCallback(() => {
    if (mapRef) mapRef.setZoom(Math.min(mapRef.getZoom() + 1, 18));
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    if (mapRef) mapRef.setZoom(Math.max(mapRef.getZoom() - 1, 4));
  }, [mapRef]);

  const getPriorityColor = (score) => {
    if (score > 8) return '#f43f5e';
    if (score > 6) return '#f59e0b';
    if (score > 4) return '#a855f7';
    return '#10b981';
  };

  if (!isLoaded) return (
    <div style={{ height: '100%', minHeight: '500px', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
      Loading Spatial Radar...
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '450px', position: 'relative', borderRadius: '4px', overflow: 'hidden', background: '#050505' }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.6; }
          50% { transform: scale(1); opacity: 0.2; }
          100% { transform: scale(0.95); opacity: 0.6; }
        }
        .cluster-pulse {
          animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
          center={HUB_POS}
          zoom={currentZoom}
          onLoad={(map) => {
            setMapRef(map);
            map.addListener('zoom_changed', () => setCurrentZoom(map.getZoom()));
          }}
          options={dynamicOptions}
        >
          {/* Strategic Operational Regions */}
          {(projectRegions || []).map((region, idx) => (
            <React.Fragment key={`region-${idx}`}>
              <CircleF
                center={region.center}
                radius={region.radius * 1000}
                options={{
                  fillColor: "rgba(79, 70, 229, 0.05)",
                  fillOpacity: 0.2,
                  strokeColor: "rgba(79, 70, 229, 0.4)",
                  strokeWeight: 1,
                  clickable: false,
                  zIndex: 5
                }}
              />
              {currentZoom > 8 && (
                <MarkerF
                  position={region.center}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    fillColor: "rgba(79, 70, 229, 0.8)",
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: "#fff",
                    scale: 3
                  }}
                />
              )}
            </React.Fragment>
          ))}

          {vizMode === 'STRATEGIC' && (
          <>
            {/* 1. Render Aggregated Hotspots as concentric circles */}
            {((clusters && clusters.hotspots) || []).map((h, i) => {
              const baseRadius = Math.sqrt(h.avgSeverity || 5) * 20000;
              const densityRadius = Math.log2((h.count || 1) + 1) * 5000;
              const totalRadius = baseRadius + densityRadius;
              
              if (isNaN(totalRadius)) return null;

              return (
                <React.Fragment key={`hotspot-${i}`}>
                   <CircleF
                    center={{ lat: parseFloat(h.lat), lng: parseFloat(h.lng) }}
                    radius={totalRadius}
                    onMouseOver={() => setHoveredHotspot(h)}
                    onMouseOut={() => setHoveredHotspot(null)}
                    options={{ 
                      fillColor: "rgba(0, 191, 255, 0.12)", 
                      fillOpacity: 0.25, 
                      strokeColor: "rgba(0, 191, 255, 0.5)", 
                      strokeWeight: 1, 
                      clickable: true,
                      zIndex: 10
                    }}
                  />
                  <CircleF
                    center={{ lat: parseFloat(h.lat), lng: parseFloat(h.lng) }}
                    radius={totalRadius * 0.7}
                    onMouseOver={() => setHoveredHotspot(h)}
                    onMouseOut={() => setHoveredHotspot(null)}
                    options={{ 
                      fillColor: (h.avgSeverity || 5) > 8 ? "rgba(244, 63, 94, 0.2)" : "rgba(0, 191, 255, 0.25)", 
                      fillOpacity: 0.4, 
                      strokeColor: (h.avgSeverity || 5) > 8 ? "rgba(244, 63, 94, 0.8)" : "rgba(0, 191, 255, 0.8)", 
                      strokeWeight: 2, 
                      clickable: true,
                      zIndex: 11
                    }}
                  />
                </React.Fragment>
              );
            })}

        <AnimatePresence>
          {hoveredHotspot && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{
                position: 'absolute',
                top: isImmersive ? '280px' : '20px',
                left: '20px',
                zIndex: 1000,
                background: 'rgba(5, 10, 15, 0.95)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 191, 255, 0.4)',
                padding: '16px',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.9)',
                minWidth: '220px',
                pointerEvents: 'none'
              }}
            >
              <div style={{ color: '#00bfff', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00bfff' }} className="cluster-pulse" />
                Regional Analysis Center
              </div>
              <div style={{ fontSize: '1.25rem', color: '#fff', fontWeight: 600, marginBottom: '4px' }}>
                {hoveredHotspot.count} Active Cases
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '16px' }}>Cluster Index #{hoveredHotspot.cluster}</div>
              
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  <span>Urgency Profile</span>
                  <span>{hoveredHotspot.avgSeverity?.toFixed(1)}/10</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (hoveredHotspot.avgSeverity || 5) * 10)}%` }}
                    style={{ height: '100%', background: (hoveredHotspot.avgSeverity || 5) > 8 ? '#f43f5e' : '#00bfff' }} 
                  />
                </div>
              </div>

              <div style={{ fontSize: '0.65rem', color: 'rgba(0, 191, 255, 0.5)', fontFamily: 'monospace' }}>
                GEO: {parseFloat(hoveredHotspot.lat).toFixed(4)}N, {parseFloat(hoveredHotspot.lng).toFixed(4)}E
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            {/* 2. Render Noise points */}
            {showNoise && ((clusters && clusters.points) || []).filter(p => p.cluster === -1).map((p, i) => (
              <CircleF
                key={`noise-${i}`}
                center={{ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }}
                radius={1500}
                options={{ 
                  fillColor: "rgba(255, 255, 255, 0.05)", 
                  fillOpacity: 0.1, 
                  strokeColor: "rgba(255, 255, 255, 0.15)", 
                  strokeWeight: 0.5, 
                  clickable: false 
                }}
              />
            ))}
          </>
        )}

        <MarkerClustererF
          options={{
            imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m',
            gridSize: 50,
            minimumClusterSize: vizMode === 'STRATEGIC' ? 999999 : 10, // Effectively disable clustering in Strategic mode
            styles: [
              { textColor: '#fff', url: 'https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m1.png', height: 53, width: 52 },
              { textColor: '#fff', url: 'https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m2.png', height: 56, width: 55 }
            ]
          }}
        >
          {(clusterer) => (
            <>
              {((clusters && clusters.points) || incidents).map((inc) => {
                const pos = { 
                  lat: parseFloat(inc.geo?.lat || inc.lat), 
                  lng: parseFloat(inc.geo?.lng || inc.lng) 
                };
                if (isNaN(pos.lat) || isNaN(pos.lng)) return null;

                const isStrategic = vizMode === 'STRATEGIC';
                const isNoise = inc.cluster === -1;
                
                // Noise points hidden in Strategic unless explicitly enabled
                if (isStrategic && isNoise && !showNoise) return null;

                const score = (inc.severity * 0.4 + inc.frequency * 0.2 + inc.resourceGap * 0.3 + inc.timeSensitivity * 0.1).toFixed(1);
                const isSelected = selectedIncident?.id === inc.id || selectedIncident?._id === inc._id;
                const color = getPriorityColor(score);
                const isMitigated = score <= 5;
                const showLabel = currentZoom > 11 || isSelected;

                return (
                  <React.Fragment key={`inc-${inc._id || inc.id || Math.random()}`}>
                    <MarkerF
                      position={pos}
                      clusterer={clusterer}
                      icon={isStrategic ? {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        fillColor: isNoise ? "#ffffff" : color,
                        fillOpacity: 1,
                        strokeWeight: 1,
                        strokeColor: "#000",
                        scale: 4 // Increased from 3 for better visibility
                      } : {
                        path: "M 0, 0 m -3, 0 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0",
                        fillColor: isMitigated ? "#94a3b8" : color,
                        fillOpacity: isSelected ? 1 : 0.8,
                        strokeWeight: isSelected ? 3 : 1,
                        strokeColor: "#fff",
                        scale: isSelected ? 1.5 : 1
                      }}
                    />
                    
                    {showLabel && (
                      <OverlayViewF
                        position={pos}
                        mapPaneName={OverlayViewF.OVERLAY_MOUSE_TARGET}
                      >
                        <div style={{ transform: 'translate(-50%, 15px)', textAlign: 'center', pointerEvents: 'none' }}>
                          <div style={{ 
                            fontSize: '10px', 
                            color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)', 
                            fontWeight: isSelected ? 600 : 400, 
                            textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                            background: isSelected ? 'rgba(0,0,0,0.6)' : 'transparent',
                            padding: isSelected ? '2px 6px' : '0',
                            borderRadius: '4px'
                          }}>
                            {inc.location || inc.title}
                          </div>
                        </div>
                      </OverlayViewF>
                    )}
                  </React.Fragment>
                );
              })}
            </>
          )}
        </MarkerClustererF>

        <AnimatePresence>
          {activeDispatches.map((dispatch) => {
            const target = incidents.find(i => (i.id === dispatch.targetId || i._id === dispatch.targetId));
            if (!target) return null;
            return (
              <OverlayViewF key={`dispatch-${dispatch.id}`} position={HUB_POS} mapPaneName={OverlayViewF.OVERLAY_MOUSE_TARGET}>
                <motion.div initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: (target.x - 50) * 10, y: (target.y - 50) * 10, opacity: 0, scale: 2 }} transition={{ duration: 1.4, ease: "anticipate" }} style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%', boxShadow: '0 0 10px var(--success)', zIndex: 100 }} />
              </OverlayViewF>
            );
          })}
        </AnimatePresence>
      </GoogleMap>

      {/* Zoom Controls */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button onClick={handleZoomIn} className="btn-map-control" style={{ borderRadius: '4px 4px 0 0' }}><Plus size={14} /></button>
        <button onClick={handleZoomOut} className="btn-map-control" style={{ borderRadius: '0 0 4px 4px' }}><Minus size={14} /></button>
      </div>

      {/* Mode Controls */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 100, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
         <button className="btn-map-mode" style={{ background: vizMode !== 'OFF' ? 'rgba(79, 70, 229, 0.4)' : 'rgba(0,0,0,0.6)' }} onClick={() => {
             const modes = ['STRATEGIC', 'HEATMAP', 'OFF'];
             setVizMode(modes[(modes.indexOf(vizMode) + 1) % modes.length]);
           }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: vizMode === 'HEATMAP' ? 'var(--danger)' : vizMode === 'STRATEGIC' ? 'var(--accent-tertiary)' : 'var(--text-dim)' }} />
            Mode: {vizMode}
         </button>
         {vizMode === 'STRATEGIC' && (
           <label className="btn-map-mode" style={{ cursor: 'pointer' }}>
             <input type="checkbox" checked={showNoise} onChange={(e) => setShowNoise(e.target.checked)} style={{ cursor: 'pointer' }} /> Show Noise
           </label>
         )}
      </div>

      {/* Legend & Zoom Indicator */}
      {vizMode === 'HEATMAP' && (
        <div className="map-legend">
          <div style={{ fontSize: '0.625rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Urgency Intensity</div>
          <div style={{ width: '120px', height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg, #10b981, #facc15, #f97316, #ef4444, #b91c1c)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}><span>Low</span><span>Critical</span></div>
        </div>
      )}
      <div className="map-zoom-tag">ZOOM: {currentZoom}</div>
    </div>
  );
}
