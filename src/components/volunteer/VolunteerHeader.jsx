import React from 'react';
import { LogOut, User, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function VolunteerHeader({ onTabChange, activeTab, notificationsCount = 0 }) {
  const { appUser, logout } = useAuth();

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem', 
      backgroundColor: 'var(--bg-panel)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--v-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
          <User size={18} />
        </div>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff' }}>{appUser?.displayName || 'Volunteer'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--v-amber)' }}>Response Unit</div>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button 
          onClick={() => onTabChange('alerts')}
          style={{ background: 'none', border: 'none', color: activeTab === 'alerts' ? 'var(--v-amber)' : 'var(--text-dim)', cursor: 'pointer', position: 'relative' }}
        >
          <Bell size={20} />
          {notificationsCount > 0 && (
            <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--error)', width: '14px', height: '14px', borderRadius: '50%', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
              {notificationsCount}
            </span>
          )}
        </button>

        <button 
          onClick={logout}
          style={{ background: 'rgba(255,100,100,0.1)', border: '1px solid rgba(255,100,100,0.2)', color: 'var(--error)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}
        >
          <LogOut size={14} /> <span className="hide-on-mobile">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
