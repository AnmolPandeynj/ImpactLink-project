import React from 'react';
import { MapPin } from 'lucide-react';

export default function AssignmentMap({ assignment }) {
  // In a real application, this would integrate Google Maps API or Mapbox via react-leaflet/react-google-maps
  // For the hackathon/demo, we render a stylized static or CSS animated map representation
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#0a0a0a' }}>
      {/* Grid Pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      
      {/* Decorative Radar pulse */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div style={{ width: '10px', height: '10px', background: 'var(--v-amber)', borderRadius: '50%', boxShadow: '0 0 20px var(--v-amber)' }} />
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)', 
          width: '60px', height: '60px', 
          border: '1px solid var(--v-amber)', borderRadius: '50%', 
          opacity: 0.5,
          animation: 'pulse 2s infinite'
        }} />
        <div style={{ 
          position: 'absolute', top: '50%', left: '50%', 
          transform: 'translate(-50%, -50%)', 
          width: '120px', height: '120px', 
          border: '1px solid rgba(245,158,11,0.2)', borderRadius: '50%', 
          animation: 'pulse 2s infinite 0.5s'
        }} />
      </div>

      <div style={{ position: 'absolute', bottom: '10px', right: '10px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
        LAT: {assignment?.lat || '28.6139'}° N <br/>
        LNG: {assignment?.lng || '77.2090'}° E
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}} />
    </div>
  );
}
