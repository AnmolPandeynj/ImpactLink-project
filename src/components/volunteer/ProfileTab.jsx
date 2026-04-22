import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { volunteerApi } from '../../services/volunteerApi';
import { User, Truck, Phone, Award, Loader2, CheckCircle2 } from 'lucide-react';

export default function ProfileTab() {
  const { appUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, [appUser]);

  const fetchProfile = async () => {
    try {
      const data = await volunteerApi.getProfile();
      setProfile(data);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      // Send allowed fields only
      const updates = {
        vehicleType: profile.vehicleType,
        vehicleCapacity: profile.vehicleCapacity,
        travelRadiusKm: profile.travelRadiusKm,
        contactPhone: profile.contactPhone,
        emergencyContact: profile.emergencyContact
      };
      await volunteerApi.updateProfile(updates);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Profile...</div>;
  }

  return (
    <div style={{ padding: '1.25rem', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <User size={24} color="var(--v-amber)" />
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Tactical Profile</h2>
      </div>

      {message && (
        <div style={{ padding: '0.75rem', background: 'rgba(52, 211, 153, 0.1)', color: '#10b981', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <CheckCircle2 size={16} /> {message}
        </div>
      )}

      {/* Stats Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
           <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--v-amber)' }}>{profile.missionsCompleted || profile.totalMissionsCompleted || 0}</div>
           <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Completed</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
           <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
             {profile.lastRating ? profile.lastRating.toFixed(1) : 'N/A'} <Award size={16} />
           </div>
           <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Rating</div>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Logistics Section */}
        <section>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--v-amber)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={16} /> Logistics & Setup
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Vehicle Type</label>
              <select 
                value={profile.vehicleType || 'none'} 
                onChange={(e) => setProfile({...profile, vehicleType: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              >
                <option value="none">None</option>
                <option value="motorcycle">Motorcycle / Bike</option>
                <option value="car">Car (Standard)</option>
                <option value="suv">SUV / 4x4</option>
                <option value="van">Van</option>
                <option value="truck">Truck (Heavy)</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Payload Cap (kg)</label>
                <input 
                  type="number" min="0" 
                  value={profile.vehicleCapacity || 0}
                  onChange={(e) => setProfile({...profile, vehicleCapacity: parseInt(e.target.value) || 0})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Range Radius (km)</label>
                <input 
                  type="number" min="5" max="500" 
                  value={profile.travelRadiusKm || profile.travelRadius || 20}
                  onChange={(e) => setProfile({...profile, travelRadiusKm: parseInt(e.target.value) || 20})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--v-amber)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Phone size={16} /> Contact Details
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Primary Phone</label>
              <input 
                type="text" 
                value={profile.contactPhone || ''}
                onChange={(e) => setProfile({...profile, contactPhone: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              />
            </div>
            
            <div style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
               <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.75rem' }}>Emergency Contact</label>
               <input 
                type="text" placeholder="Name"
                value={profile.emergencyContact?.name || ''}
                onChange={(e) => setProfile({...profile, emergencyContact: { ...profile.emergencyContact, name: e.target.value }})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', marginBottom: '0.5rem' }}
              />
               <input 
                type="text" placeholder="Phone"
                value={profile.emergencyContact?.phone || ''}
                onChange={(e) => setProfile({...profile, emergencyContact: { ...profile.emergencyContact, phone: e.target.value }})}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              />
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%', padding: '1rem', borderRadius: '8px', border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: '1rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            marginTop: '1rem'
          }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
