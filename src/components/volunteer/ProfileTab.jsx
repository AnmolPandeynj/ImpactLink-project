import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Trash2, 
  Plus, 
  Truck, 
  Car,
  Bike,
  Ship,
  Navigation,
  ShieldCheck, 
  ChevronRight,
  Info,
  Check,
  MapPin
} from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { updateMyProfile } from '../../services/volunteerApi';
import { formatCoords } from '../../services/coordResolver';

export default function ProfileTab() {
  const { appUser, refreshUser } = useAuth();
  const volInfo = appUser?.linkedVolunteerId;

  const [skills, setSkills] = useState(volInfo?.skills || []);
  const [vehicle, setVehicle] = useState(volInfo?.vehicleType || 'none');
  const [isSaving, setIsSaving] = useState(false);

  const availableSkills = [
    'first_aid', 'medical', 'search_rescue', 'logistics',
    'communication', 'translation', 'counseling', 'driving',
    'heavy_vehicle', 'water_rescue', 'shelter_setup', 'food_distribution'
  ];

  const toggleSkill = (skill) => {
    setSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await updateMyProfile({ skills, vehicleType: vehicle });
      await refreshUser();
    } catch (err) {
      console.error('Profile update failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ textAlign: 'center', padding: '1rem 0' }}>
         <div style={{ 
           width: '100px', height: '100px', borderRadius: '32px',
           background: 'linear-gradient(45deg, #111, #222)', margin: '0 auto 1.5rem',
           display: 'flex', alignItems: 'center', justifyContent: 'center',
           border: '1px solid rgba(255,255,255,0.08)', position: 'relative'
         }}>
           <User size={48} color="var(--text-dim)" />
           <div style={{ 
             position: 'absolute', bottom: '-5px', right: '-5px',
             background: '#10B981', width: '28px', height: '28px',
             borderRadius: '50%', border: '4px solid #000',
             display: 'flex', alignItems: 'center', justifyContent: 'center'
           }}>
             <ShieldCheck size={14} color="#fff" />
           </div>
         </div>
         <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{appUser?.displayName}</h1>
         <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
           Tactical ID: {volInfo?._id?.toString().slice(-8).toUpperCase()}
         </p>
         {/* Last Known Position */}
         {volInfo?.liveLocation?.lat != null ? (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', color: '#10b981', fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
             <MapPin size={11} />
             {formatCoords(volInfo.liveLocation.lat, volInfo.liveLocation.lng)}
             {volInfo.liveLocation.updatedAt && (
               <span style={{ color: 'var(--text-dim)', fontFamily: 'inherit', fontWeight: 400, marginLeft: '0.25rem' }}>
                 · {(() => {
                   const mins = Math.floor((Date.now() - new Date(volInfo.liveLocation.updatedAt).getTime()) / 60000);
                   if (mins < 1) return 'just now';
                   if (mins < 60) return `${mins}m ago`;
                   return `${Math.floor(mins / 60)}h ago`;
                 })()}
               </span>
             )}
           </div>
         ) : (
           <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
             <MapPin size={11} /> Location not yet shared
           </div>
         )}
      </header>

      {/* Skills Selection */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tactical Capabilities</h3>
          <Info size={14} color="var(--text-dim)" />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {availableSkills.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              style={{
                padding: '0.6rem 1.25rem', borderRadius: '100px', fontSize: '0.85rem',
                fontWeight: 600, border: '1px solid',
                borderColor: skills.includes(skill) ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                background: skills.includes(skill) ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                color: skills.includes(skill) ? '#F59E0B' : 'var(--text-dim)',
                transition: 'all 0.2s ease', cursor: 'pointer', textTransform: 'capitalize'
              }}
            >
              {skill.replace('_', ' ')}
            </button>
          ))}
        </div>
      </section>

      {/* Transport Class */}
      <section>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Transport Profile</h3>
        <div style={{ 
          background: '#111', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden'
        }}>
          {['none', 'motorcycle', 'car', 'suv', 'van', 'truck', 'boat'].map(t => {
            let Icon = Truck;
            if (t === 'car' || t === 'suv' || t === 'van') Icon = Car;
            if (t === 'motorcycle') Icon = Bike;
            if (t === 'boat') Icon = Ship;
            if (t === 'none') Icon = Navigation;

            return (
              <div 
                key={t}
                onClick={() => setVehicle(t)}
                style={{
                  padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
                  borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer',
                  background: vehicle === t ? 'rgba(255,255,255,0.02)' : 'transparent'
                }}
              >
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: vehicle === t ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={20} color={vehicle === t ? '#F59E0B' : 'var(--text-dim)'} />
                </div>
                <div style={{ flex: 1, textTransform: 'capitalize', fontWeight: 600 }}>{t}</div>
                {vehicle === t && <Check size={20} color="#F59E0B" />}
              </div>
            );
          })}
        </div>
      </section>

      <button
        onClick={saveProfile}
        disabled={isSaving}
        style={{
          width: '100%', padding: '1.25rem', borderRadius: '100px',
          background: 'var(--primary)', color: '#fff', fontSize: '1.1rem',
          fontWeight: 700, border: 'none', cursor: 'pointer',
          marginTop: '1rem', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)'
        }}
      >
        {isSaving ? 'Syncing Profile...' : 'Save Configuration'}
      </button>

      <div style={{ height: '2rem' }} /> {/* Padding for bottom navigation */}
    </div>
  );
}
