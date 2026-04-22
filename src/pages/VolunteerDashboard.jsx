import React, { useState } from 'react';
import { Compass, Map, Calendar, User, Clock, AlertTriangle } from 'lucide-react';
import VolunteerHeader from '../components/volunteer/VolunteerHeader';
import { useAssignment } from '../hooks/useAssignment';

// Sub-components will go here later
import HomeTab from '../components/volunteer/HomeTab';
import AssignmentTab from '../components/volunteer/AssignmentTab';
import ScheduleTab from '../components/volunteer/ScheduleTab';
import ProfileTab from '../components/volunteer/ProfileTab';

export default function VolunteerDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const { assignment, status, refresh } = useAssignment();

  // If there's an active assignment, we might want to default to the assignment tab or highlight it
  const isAssigned = assignment !== null && status !== 'unassigned' && status !== 'completed';

  const renderTab = () => {
    switch(activeTab) {
      case 'home': return <HomeTab onNavigate={setActiveTab} assignment={assignment} status={status} />;
      case 'assignment': return <AssignmentTab assignment={assignment} status={status} onRefresh={refresh} />;
      case 'schedule': return <ScheduleTab />;
      case 'profile': return <ProfileTab />;
      case 'history': return <div style={{padding:'1rem', color:'#fff'}}>History Module (In Development)</div>;
      case 'alerts': return <div style={{padding:'1rem', color:'#fff'}}>Alerts Module (In Development)</div>;
      default: return <HomeTab />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-main)' }} className="volunteer-shell">
      <VolunteerHeader onTabChange={setActiveTab} activeTab={activeTab} notificationsCount={isAssigned ? 1 : 0} />
      
      <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '70px' }}>
        {renderTab()}
      </main>

      {/* Bottom Navigation for Mobile-first interface */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '65px', backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <NavButton id="home" icon={Compass} label="Home" active={activeTab} onClick={setActiveTab} />
        
        <div style={{ position: 'relative' }}>
          <NavButton id="assignment" icon={Map} label="Mission" active={activeTab} onClick={setActiveTab} highlight={isAssigned} />
          {isAssigned && <div style={{ position: 'absolute', top: '5px', right: '15px', width: '10px', height: '10px', backgroundColor: 'var(--v-amber)', borderRadius: '50%', boxShadow: '0 0 10px var(--v-amber)' }} />}
        </div>
        
        <NavButton id="schedule" icon={Calendar} label="Schedule" active={activeTab} onClick={setActiveTab} />
        <NavButton id="profile" icon={User} label="Profile" active={activeTab} onClick={setActiveTab} />
      </nav>
    </div>
  );
}

function NavButton({ id, icon: Icon, label, active, onClick, highlight }) {
  const isActive = active === id;
  const color = isActive ? 'var(--v-amber)' : (highlight ? '#fff' : 'var(--text-dim)');
  
  return (
    <button 
      onClick={() => onClick(id)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        background: 'none', border: 'none', width: '25%', height: '100%',
        color, cursor: 'pointer',
        transition: 'color 0.2s'
      }}
    >
      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
      <span style={{ fontSize: '0.65rem', fontWeight: isActive ? 600 : 400 }}>{label}</span>
    </button>
  );
}
