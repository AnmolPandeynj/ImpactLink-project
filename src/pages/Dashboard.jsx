import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Map as MapIcon, 
  Zap, 
  Users, 
  FileSearch, 
  Settings,
  Plus,
  Cpu,
  MoreHorizontal,
  ChevronRight,
  Crosshair,
  BarChart2,
  LogOut,
  User,
  HandHeart,
  ShieldCheck,
  Radar,
  Search,
  Filter,
  Eye,
  ChevronDown,
  Package,
  ChevronLeft,
  List
} from 'lucide-react';
import BeneficiaryModal from '../components/Modals/BeneficiaryModal';
import VolunteerModal from '../components/Modals/VolunteerModal';
import ResourceLogisticsTab from '../components/Resources/ResourceLogisticsTab';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ImpactSimulator from '../components/Simulator/ImpactSimulator';
import ActionCenter from '../components/ActionCenter/ActionCenter';
import KineticMap from '../components/Map/KineticMap';
import SectorPulseBoard from '../components/Radar/SectorPulseBoard';
import MisallocationRadar from '../components/Radar/MisallocationRadar';
import AIGlobalAdvisory from '../components/Radar/AIGlobalAdvisory';
import RedeploymentStrategy from '../components/Radar/RedeploymentStrategy';
import NewIncidentModal from '../components/Modals/NewIncidentModal';
import WorkspaceModal from '../components/Modals/WorkspaceModal';
import ProjectWizard from '../components/Modals/ProjectWizard/ProjectWizard';
import { extractDataFromReport, getNetworkAnomalyAnalysis, getStrategicReallocationAdvice } from '../services/gemini';
import { getSectorHealthStatus, getStrategicMissions, getUrgencyDecay } from '../services/logic';
import { runAllocation, fetchCriticalUnmet, rerunAllocation } from '../services/api';

import { logout } from '../services/firebase';
import { resolveCoordinates } from '../services/coordinates';
import * as api from '../services/api';
import { dbscan, aggregateClusters } from '../services/clustering';

/**
 * Utility: Format a date to relative time string
 */
function timeAgo(dateStr) {
  if (!dateStr) return 'just now';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

import { useProject } from '../context/ProjectContext';
import ProjectSelector from '../components/ProjectSelector';

const NavGroup = ({ label, items, activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isActiveGroup = items.some(i => i.id === activeTab);
  
  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          color: isActiveGroup ? '#fff' : 'var(--text-muted)',
          background: isActiveGroup ? 'rgba(255,255,255,0.08)' : 'transparent',
          padding: '0.5rem 1rem', fontSize: '0.8125rem',
          fontWeight: isActiveGroup ? 500 : 400,
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          transition: 'all 0.2s ease', whiteSpace: 'nowrap'
        }}
        onMouseEnter={e => { if (!isActiveGroup) e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { if (!isActiveGroup) e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        {label} <ChevronDown size={14} style={{ opacity: 0.7, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: '120%', left: '50%', transform: 'translateX(-50%)',
              background: '#111', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column',
              gap: '0.25rem', minWidth: '160px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 100
            }}
          >
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem', border: 'none', cursor: 'pointer',
                  background: activeTab === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: activeTab === item.id ? '#fff' : 'var(--text-dim)',
                  borderRadius: '6px', textAlign: 'left', fontSize: '0.8125rem', transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (activeTab !== item.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; } }}
                onMouseLeave={e => { if (activeTab !== item.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; } }}
              >
                <item.icon size={14} style={{ opacity: activeTab === item.id ? 1 : 0.7, color: 'var(--primary)' }} />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Dashboard() {
  const { currentProject } = useProject();
  const [viewMode, setViewMode] = useState('immersive');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const [incidents, setIncidents] = useState([]);
  const [activeDispatches, setActiveDispatches] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [supplies, setSupplies] = useState([]);
  const [clusters, setClusters] = useState({ points: [], hotspots: [] });
  const [isIngesting, setIsIngesting] = useState(false);
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [isBeneficiaryOpen, setIsBeneficiaryOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [selectedVolunteer, setSelectedVolunteer] = useState(null);
  const [isVolunteerDetailOpen, setIsVolunteerDetailOpen] = useState(false);
  const [isProjectWizardOpen, setIsProjectWizardOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [allocationResult, setAllocationResult] = useState(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [criticalUnmet, setCriticalUnmet] = useState([]);
  const [allocationAdvice, setAllocationAdvice] = useState('');


  const { refreshProjects, switchProject } = useProject();

  useEffect(() => {
    loadAllData();
  }, [currentProject]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const projectId = currentProject?._id;
      const [incData, benData, cluData, volData, supData] = await Promise.allSettled([
        api.fetchIncidents(projectId),
        api.fetchBeneficiaries(projectId),
        api.fetchClusters(projectId),
        api.fetchVolunteers(projectId),
        api.fetchResourceHub(projectId)
      ]);
      if (incData.status === 'fulfilled') setIncidents(incData.value);
      if (benData.status === 'fulfilled') setBeneficiaries(benData.value);
      if (supData.status === 'fulfilled') setSupplies(supData.status === 'fulfilled' ? supData.value : []);
      if (cluData.status === 'fulfilled') {
        const val = cluData.value;
        if (Array.isArray(val)) {
          setClusters({ points: val, hotspots: [] });
        } else {
          setClusters(val);
        }
      }
      if (volData.status === 'fulfilled') setVolunteers(volData.value);
    } catch (error) {
      console.error("Data loading error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Allocation efficiency: prefer saturationRate from DB if available, else fallback to gap calc
  const allocationEfficiency = useMemo(() => {
    if (incidents.length === 0) return 100;
    const incidentsWithSaturation = incidents.filter(inc => inc.saturationRate !== undefined && inc.saturationRate > 0);
    if (incidentsWithSaturation.length > 0) {
      // Engine-produced efficiency: average saturation across all incidents
      const avgSaturation = incidentsWithSaturation.reduce((sum, inc) => sum + (inc.saturationRate || 0), 0) / incidents.length;
      return (avgSaturation * 100).toFixed(1);
    }
    // Fallback: gap-based estimate (pre-engine-run)
    const totalGap = incidents.reduce((sum, inc) => sum + (inc.resourceGap || 5), 0);
    const maxGap = incidents.length * 10;
    return (((maxGap - totalGap) / maxGap) * 100).toFixed(1);
  }, [incidents]);


  // Combine incidents and beneficiaries into a unified spatial array for map and clustering
  const mapPoints = useMemo(() => {
    const validIncidents = incidents.map(i => ({ ...i, __type: 'incident' }));
    
    const validBeneficiaries = beneficiaries
      .filter(b => b.geo && b.geo.lat && b.geo.lng)
      .map(b => ({
        ...b,
        id: b._id,
        title: b.name || 'Beneficiary',
        location: b.rawLocation || 'Unknown Location',
        severity: b.needSeverity === 'high' ? 8 : b.needSeverity === 'medium' ? 5 : 2,
        resourceGap: 5,
        frequency: 1,
        timeSensitivity: b.calculatedUrgency || 5,
        lat: b.geo.lat,
        lng: b.geo.lng,
        __type: 'beneficiary',
        eventType: b.primaryNeed || 'Beneficiary'
      }));
      
    return [...validIncidents, ...validBeneficiaries];
  }, [incidents, beneficiaries]);

  // Reactive Strategic Clustering (separate from heatmap)
  const strategicClusters = useMemo(() => {
    if (mapPoints.length === 0) return { points: [], hotspots: [] };
    // Increased EPS to 1.5 for broader state-level clustering
    // Increased minSamples to 3 to ignore low-density outliers
    const labels = dbscan(mapPoints, 1.5, 3); 
    return aggregateClusters(mapPoints, labels);
  }, [mapPoints]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleCreateIncident = async (newInc) => {
    try {
      const savedIncident = await api.createIncident(newInc);
      setIncidents(prev => [savedIncident, ...prev]);
    } catch (error) {
      console.error("Failed to save new incident:", error);
    }
  };

  const handleCreateBeneficiary = async (data) => {
    try {
      const saved = await api.createBeneficiary(data);
      setBeneficiaries(prev => [saved, ...prev]);
    } catch (error) {
      console.error("Failed to save beneficiary:", error);
    }
  };

  const handleRunAllocation = async () => {
    if (isAllocating) return;
    setIsAllocating(true);
    setAllocationAdvice('');
    try {
      const projectId = currentProject?._id;
      const result = await runAllocation(projectId);
      setAllocationResult(result);
      // Refresh incidents to get updated saturationRate
      const updatedIncidents = await api.fetchIncidents(projectId);
      setIncidents(updatedIncidents);
      // Fetch critical unmet missions
      const unmet = await fetchCriticalUnmet(projectId);
      setCriticalUnmet(unmet);
      // Async: get Pro strategic advice (non-blocking, may rate-limit)
      getStrategicReallocationAdvice(result)
        .then(setAllocationAdvice)
        .catch(err => setAllocationAdvice(err.message?.includes('rate-limited') ? err.message : ''));
    } catch (error) {
      console.error('Allocation failed:', error);
      alert(`Allocation error: ${error.message}`);
    } finally {
      setIsAllocating(false);
    }
  };

  const handleDispatch = async (incidentId, volunteerCount) => {

    const dispatchId = Date.now();
    setActiveDispatches(prev => [...prev, { id: dispatchId, targetId: incidentId, volunteers: volunteerCount }]);
    
    const targetIncident = incidents.find(i => i._id === incidentId || i.id === incidentId);
    if (!targetIncident) return;

    const updatedData = {
      resourceGap: Math.max(1, targetIncident.resourceGap - (volunteerCount * 1.5)),
      severity: Math.max(1, targetIncident.severity - 4)
    };

    setTimeout(async () => {
      setActiveDispatches(prev => prev.filter(d => d.id !== dispatchId));
      try {
        const saved = await api.patchIncident(targetIncident._id || incidentId, updatedData);
        setIncidents(prev => prev.map(inc => (inc._id === (saved._id || incidentId) ? saved : inc)));
      } catch (error) {
        console.error("Dispatch update failed:", error);
      }
    }, 1400);
  };

  const handleIngestion = async (data) => {
    const coords = resolveCoordinates(data.location);
    const newIncident = {
      ...data,
      title: `${data.needType || 'General Need'} - ${data.location || 'Unknown Area'}`,
      eventType: data.needType || 'General',
      type: (data.severity || 5) > 8 ? 'Critical' : 'Alert',
      severity: Number(data.severity) || 5,
      resourceGap: Number(data.resourceGap) || 5,
      frequency: Number(data.frequency) || 5,
      timeSensitivity: Number(data.timeSensitivity) || 5,
      lat: coords.lat,
      lng: coords.lng
    };
    
    try {
      const savedIncident = await api.createIncident(newIncident);
      setIncidents(prev => [savedIncident, ...prev]);
      setActiveTab('overview');
    } catch (error) {
      console.error("Failed to save ingested incident:", error);
      alert(`Backend rejected the incident data: ${error.message}`);
    }
  };

  const handleUpdateResource = async (id, data) => {
    try {
      const updated = await api.updateResource(id, data);
      setSupplies(prev => prev.map(s => s._id === id ? updated : s));
    } catch (error) {
      console.error("Failed to update resource:", error);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setIsProjectWizardOpen(true);
  };

  const handleDeleteProject = async (projectId) => {
    try {
      await api.deleteProject(projectId);
      await refreshProjects();
      // If deleted project was active, switch to first available
      if (currentProject?._id === projectId) {
        switchProject(null); // ProjectContext should handle fallback
      }
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
           <div style={{ width: '12px', height: '12px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 20px #fff' }} />
        </motion.div>
      </div>
    );
  }

  const mainNavItems = [
    { id: 'overview', icon: Activity, label: 'Overview' },
    { id: 'analysis', icon: Crosshair, label: 'Threat Radar' },
    { id: 'ai_radar', icon: Zap, label: 'AI Insights' }
  ];

  const opsNavItems = [
    { id: 'ingestion', icon: FileSearch, label: 'Data Ingestion' },
    { id: 'supplies', icon: Package, label: 'Resource Logistics' },
    { id: 'beneficiaries', icon: Users, label: 'Beneficiaries' },
    { id: 'volunteers', icon: HandHeart, label: 'Responders' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ 
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '0 2rem',
        display: 'grid', 
        gridTemplateColumns: '1fr auto 1fr',
        gap: '2rem',
        alignItems: 'center',
        height: '4.5rem',
        background: viewMode === 'immersive' ? 'rgba(15, 15, 15, 0.35)' : 'var(--bg-main)',
        backdropFilter: viewMode === 'immersive' ? 'blur(24px)' : 'none',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Left Column: Logo & Context */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div 
            onClick={() => window.location.href = '/'}
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600, letterSpacing: '-0.02em', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}
          >
            <div style={{ width: '16px', height: '16px', background: 'linear-gradient(135deg, #fff 0%, #666 100%)', borderRadius: '4px', boxShadow: '0 0 10px rgba(255,255,255,0.2)' }} />
            ImpactLink
          </div>

          <ProjectSelector 
            onNewProject={() => { setEditingProject(null); setIsProjectWizardOpen(true); }} 
            onEditProject={handleEditProject}
            onDeleteProject={handleDeleteProject}
          />
        </div>

        {/* Center Column: Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {mainNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                color: activeTab === item.id ? '#fff' : 'var(--text-muted)',
                background: activeTab === item.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: activeTab === item.id ? 500 : 400,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              onMouseEnter={e => { if (activeTab !== item.id) e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { if (activeTab !== item.id) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <item.icon size={14} style={{ opacity: activeTab === item.id ? 1 : 0.7 }} />
              {item.label}
            </button>
          ))}
          
          {/* Grouped Workflow Tabs */}
          <NavGroup label="Operations" items={opsNavItems} activeTab={activeTab} setActiveTab={setActiveTab} />
        </nav>

        {/* Right Column: Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button 
            onClick={() => setViewMode(m => m === 'immersive' ? 'classic' : 'immersive')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.875rem', borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
          >
            {viewMode === 'immersive' ? <Eye size={14} color="var(--primary)" /> : <MapIcon size={14} />} 
            {viewMode === 'immersive' ? 'Exit Immersive' : 'Immersive Map'}
          </button>

          <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.1)', margin: '0 0.25rem' }} />

          <button 
            onClick={() => setIsBeneficiaryOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', padding: '0.5rem 0.875rem', borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <User size={14} /> Record
          </button>

          <button 
            onClick={() => setIsWorkspaceOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', padding: '0.5rem 0.875rem', borderRadius: '8px', color: '#fff', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Settings size={14} /> Workspace
          </button>
          
          {/* Run Allocation Engine */}
          <button
            onClick={handleRunAllocation}
            disabled={isAllocating}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              fontSize: '0.8125rem', padding: '0.5rem 1rem', borderRadius: '8px',
              border: `1px solid ${isAllocating ? 'rgba(251,146,60,0.4)' : allocationResult ? 'rgba(16,185,129,0.4)' : 'rgba(56,189,248,0.3)'}`,
              background: isAllocating ? 'rgba(251,146,60,0.08)' : allocationResult ? 'rgba(16,185,129,0.08)' : 'rgba(56,189,248,0.08)',
              color: isAllocating ? 'var(--warning)' : allocationResult ? 'var(--success)' : '#38bdf8',
              cursor: isAllocating ? 'not-allowed' : 'pointer',
              fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            <Zap size={14} />
            {isAllocating ? 'Allocating...' : allocationResult ? `Allocated · ${allocationResult.pass1?.assignments + allocationResult.pass2?.dispatches}` : 'Run Allocation'}
          </button>

          <button 
            className="btn-primary" 
            onClick={() => setIsNewIncidentOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <Plus size={14} /> Incident
          </button>

          
          <button 
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', marginLeft: '0.5rem' }}
            title="Log Out"
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {viewMode === 'immersive' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'auto' }}>
          <KineticMap 
            isImmersive={true} 
            incidents={mapPoints} 
            activeDispatches={activeDispatches} 
            clusters={strategicClusters} 
            projectRegions={currentProject?.regions}
            volunteers={volunteers}
          />
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: viewMode === 'immersive' ? '2rem 4rem' : '3rem 4rem', position: 'relative', zIndex: 1, pointerEvents: viewMode === 'immersive' ? 'none' : 'auto' }}>
        {viewMode === 'classic' && <div className="radial-glow" style={{ top: '-10%', left: '20%' }} />}
        
        {viewMode === 'classic' && (
        <div style={{ marginBottom: '4rem', maxWidth: '800px', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-subtle)', borderRadius: '1rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
             <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
             Gemini 2.5 Flash Engine is Active
          </div>
          <h1 className="hero-title">Extreme Orchestration for Smart Resource Allocation</h1>
          <p className="hero-subtitle">Aggregating scattered NGO data. Eliminating misallocation through AI-driven visibility.</p>
        </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ width: '100%', maxWidth: '1400px', alignSelf: 'center', flex: 1, pointerEvents: (viewMode === 'immersive' && activeTab === 'overview') ? 'none' : 'auto' }}
          >
            {activeTab === 'overview' && (
              <OverviewTab 
                incidents={mapPoints} 
                setIncidents={setIncidents} 
                activeDispatches={activeDispatches} 
                setActiveDispatches={setActiveDispatches} 
                clusters={strategicClusters} 
                onDispatch={handleDispatch}
                allocationEfficiency={allocationEfficiency}
                viewMode={viewMode}
                allocationResult={allocationResult}
                criticalUnmet={criticalUnmet}
                allocationAdvice={allocationAdvice}
                volunteers={volunteers}
              />
            )}
            {activeTab === 'analysis' && <AnalysisTab incidents={incidents} volunteers={volunteers} />}
            {activeTab === 'ai_radar' && <AIRadarTab clusters={strategicClusters} incidents={incidents} />}
            {activeTab === 'supplies' && <ResourceLogisticsTab project={currentProject} resources={supplies} onUpdateResource={handleUpdateResource} />}
            {activeTab === 'beneficiaries' && <BeneficiariesTab beneficiaries={beneficiaries} onView={(b) => {
              setSelectedBeneficiary(b);
              setIsViewOpen(true);
            }} />}
            {activeTab === 'volunteers' && <VolunteersTab volunteers={volunteers} onView={(v) => {
              setSelectedVolunteer(v);
              setIsVolunteerDetailOpen(true);
            }} />}
            {activeTab === 'ingestion' && <IngestionTab onIngest={handleIngestion} isIngesting={isIngesting} setIsIngesting={setIsIngesting} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <NewIncidentModal 
        isOpen={isNewIncidentOpen} 
        onClose={() => setIsNewIncidentOpen(false)} 
        onAdd={handleCreateIncident} 
      />

      <BeneficiaryModal
        isOpen={isBeneficiaryOpen}
        onClose={() => setIsBeneficiaryOpen(false)}
        onAdd={handleCreateBeneficiary}
      />

      <AnimatePresence>
        {isProjectWizardOpen && (
          <ProjectWizard 
            onClose={() => {
              setIsProjectWizardOpen(false);
              setEditingProject(null);
            }} 
            initialData={editingProject}
          />
        )}
      </AnimatePresence>

      <BeneficiaryModal 
        isOpen={isViewOpen} 
        onClose={() => {
          setIsViewOpen(false);
          setSelectedBeneficiary(null);
        }} 
        mode="VIEW"
        initialData={selectedBeneficiary}
      />

      <VolunteerModal 
        isOpen={isVolunteerDetailOpen} 
        onClose={() => {
          setIsVolunteerDetailOpen(false);
          setSelectedVolunteer(null);
        }} 
        initialData={selectedVolunteer}
      />

      <WorkspaceModal 
        isOpen={isWorkspaceOpen} 
        onClose={() => setIsWorkspaceOpen(false)}
        onReset={() => {
          setIncidents([]);
          setIsWorkspaceOpen(false);
        }}
        onScenario={(id) => {
          const scenarioData = {
            flood: [
              { id: 101, title: 'Flash Flood - Wayanad, Kerala', location: 'Kerala', needType: 'Water', severity: 9, resourceGap: 8, frequency: 7, timeSensitivity: 9, lat: 11.6050, lng: 76.0828 },
              { id: 102, title: 'Brahmaputra Overflow - Assam', location: 'Assam', needType: 'Medical', severity: 7, resourceGap: 9, frequency: 5, timeSensitivity: 8, lat: 26.2006, lng: 92.9376 }
            ],
            earthquake: [
              { id: 201, title: 'Structural Collapse - Delhi NCR', location: 'Delhi', needType: 'Infrastructure', severity: 10, resourceGap: 10, frequency: 9, timeSensitivity: 10, lat: 28.6139, lng: 77.2090 },
              { id: 202, title: 'Casualties - Bhuj Region', location: 'Gujarat', needType: 'Medical', severity: 9, resourceGap: 8, frequency: 8, timeSensitivity: 10, lat: 23.2420, lng: 69.6669 }
            ],
            conflict: [
              { id: 301, title: 'IDP Movement - Jammu Border', location: 'J&K', needType: 'Food', severity: 8, resourceGap: 9, frequency: 8, timeSensitivity: 7, lat: 32.7330, lng: 74.8643 }
            ]
          };
          setIncidents(scenarioData[id] || []);
        }}
      />
    </div>
  );
}

function OverviewTab({ incidents, activeDispatches, setIncidents, setActiveDispatches, clusters, onDispatch, allocationEfficiency, viewMode, volunteers, allocationResult, criticalUnmet = [], allocationAdvice }) {
  const [selectedMission, setSelectedMission] = useState(null);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isDrillingDown, setIsDrillingDown] = useState(false);

  const missions = getStrategicMissions(incidents);

  // Critical Unmet Alert Panel — surface missions with no coverage
  const renderCriticalUnmetPanel = () => {
    if (!criticalUnmet || criticalUnmet.length === 0) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          marginBottom: '1.5rem',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '10px',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={13} />
            Strategic Missions Panel — {criticalUnmet.length} Critical Unmet
          </div>
          <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>No mobile coverage found</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {criticalUnmet.slice(0, 5).map((m, idx) => {
            const decay = getUrgencyDecay(m.createdAt || m.eventTime);
            return (
              <div key={m._id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.04)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.12)' }}>
                <div>
                  <span style={{ fontSize: '0.8125rem', color: '#fff', fontWeight: 600 }}>{m.location || m.title || m.eventType}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '0.75rem' }}>Sev {m.severity} · Gap {m.resourceGap}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Urgency decay badge */}
                  <span style={{ fontSize: '0.625rem', fontFamily: 'monospace', padding: '0.15rem 0.35rem', borderRadius: '3px', background: decay < 0.6 ? 'rgba(251,146,60,0.15)' : 'rgba(16,185,129,0.1)', color: decay < 0.6 ? 'var(--warning)' : 'var(--success)' }}>
                    ⏱ {(decay * 100).toFixed(0)}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--error)', fontWeight: 700 }}>ESCALATE</span>
                </div>
              </div>
            );
          })}
        </div>
        {allocationAdvice && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(56,189,248,0.03)', border: '1px solid rgba(56,189,248,0.12)', borderRadius: '6px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            <span style={{ color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', marginRight: '0.5rem' }}>Strategic AI:</span>
            {allocationAdvice}
          </div>
        )}
      </motion.div>
    );
  };

  const renderStats = (isImmersive) => (
    <div style={{ display: 'flex', gap: isImmersive ? '3rem' : '4rem', alignItems: 'center' }}>
      <div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Active Incidents</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 500, color: '#fff' }}>{incidents.length}</div>
      </div>
      <div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Visibility Index</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 500, color: '#fff' }}>
          {(() => {
            const sectors = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 6', 'Sector 7', 'Sector 8'];
            const stableSectors = sectors.filter(s => {
              const status = getSectorHealthStatus(incidents, s);
              return status.label === 'STABLE' || status.label === 'NOMINAL';
            }).length;
            const ratio = (stableSectors / sectors.length) * 100;
            return ratio.toFixed(0);
          })()}% 
          <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}> NOMINAL</span>
        </div>
      </div>
      <div>
        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Allocation Efficiency</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 500, color: '#fff' }}>{allocationEfficiency}%</div>
      </div>
      {!isImmersive && (
        <div style={{ marginLeft: 'auto' }}>
           <button className="btn" style={{ border: '1px solid var(--border-strong)' }}><BarChart2 size={14} /> Full Report</button>
        </div>
      )}
    </div>
  );

  const renderPriorityQueue = (isImmersive) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', overflowX: 'hidden' }}>
      {!selectedMission && !selectedIncident ? (
        <>
          <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem 1.5rem', background: isImmersive ? 'rgba(0,0,0,0.2)' : 'transparent', position: 'sticky', top: 0, zIndex: 10 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}><Activity size={16} /> Strategic Missions</div>
             <MoreHorizontal size={16} color="var(--text-dim)" />
          </div>
          
          <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', flex: 1, padding: isImmersive ? '0 1rem' : '0' }}>
            {missions
              .map((mission, idx) => {
                const isCritical = mission.strategicPriority > 8;
                return (
                  <motion.div 
                    key={mission.id} 
                    onClick={() => {
                      setSelectedMission(mission);
                      setIsDrillingDown(false);
                    }}
                    whileHover={{ x: 4, background: 'rgba(255,255,255,0.03)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{ 
                      padding: '1.25rem 1rem', 
                      background: 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      borderRadius: isImmersive ? '12px' : '0',
                      marginTop: isImmersive ? '0.5rem' : '0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                         <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isCritical && (
                              <motion.div 
                                animate={{ opacity: [0.4, 1, 0.4] }} 
                                transition={{ duration: 1.2, repeat: Infinity }}
                                style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)' }} 
                              />
                            )}
                            {mission.name}
                         </span>
                         <span style={{ fontSize: '0.625rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {mission.count} Active Needs • {mission.primaryNeed} Focus
                         </span>
                      </div>
                      <span style={{ color: isCritical ? '#fff' : 'var(--text-muted)', fontSize: '1rem', fontWeight: 800, fontFamily: 'monospace' }}>
                        {mission.strategicPriority.toFixed(1)}
                      </span>
                    </div>
                    
                    <div style={{ width: '100%', height: '2px', background: 'rgba(255,255,255,0.03)', borderRadius: '1px', marginTop: '0.25rem' }}>
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${(mission.strategicPriority/10)*100}%` }}
                         style={{ height: '100%', background: isCritical ? 'var(--danger)' : 'var(--success)', borderRadius: '1px' }}
                       />
                    </div>
                  </motion.div>
                )
              })}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8125rem' }} 
            onClick={() => {
              if (isDrillingDown) {
                setIsDrillingDown(false);
              } else {
                setSelectedMission(null);
                setSelectedIncident(null);
              }
            }}
          >
            <ChevronLeft size={14} /> {selectedIncident ? `Back to ${selectedMission?.name || 'Drill Down'}` : isDrillingDown ? `Back to ${selectedMission.name}` : 'Back to Missions'}
          </div>

          {!isDrillingDown && selectedMission && !selectedIncident && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
               <div>
                 <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>{selectedMission.name} Mission</h3>
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ padding: '0.25rem 0.75rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' }}>
                       {selectedMission.count} Beneficiaries
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                       Priority Score: <span style={{ color: '#fff', fontWeight: 700 }}>{selectedMission.strategicPriority.toFixed(2)}</span>
                    </div>
                 </div>
               </div>

               <div className="pane" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.05em' }}>Cluster Composition</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                     {Object.entries(selectedMission.categories).map(([cat, count]) => (
                       <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{cat}</span>
                          <span style={{ fontSize: '0.8125rem', color: '#fff', fontWeight: 600 }}>{count}</span>
                       </div>
                     ))}
                  </div>
               </div>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem' }}>
                     <Zap size={16} /> Bulk Hub Dispatch
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => setIsDrillingDown(true)}
                    style={{ width: '100%', justifyContent: 'center', border: '1px solid var(--border-subtle)', height: '3rem' }}
                  >
                     <List size={14} /> Drill Down to Individuals
                  </button>
               </div>
            </div>
          )}

          {isDrillingDown && selectedMission && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                  Individual Reports: {selectedMission.name}
               </div>
               <div className="no-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', padding: isImmersive ? '0 0.5rem' : '0' }}>
                 {selectedMission.incidents
                   .sort((a,b) => b.severity - a.severity)
                   .map((inc, idx) => (
                   <motion.div 
                     key={inc._id || inc.id} 
                     onClick={() => {
                       setSelectedIncident(inc);
                       setIsDrillingDown(false);
                     }}
                     whileHover={{ background: 'rgba(255,255,255,0.05)', scale: 1.01 }}
                     whileTap={{ scale: 0.98 }}
                     style={{ 
                       padding: '1.25rem', 
                       borderRadius: '12px', 
                       border: '1px solid rgba(255,255,255,0.05)',
                       background: 'rgba(255,255,255,0.02)',
                       cursor: 'pointer',
                       transition: 'all 0.2s ease'
                     }}
                   >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                         <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{inc.title}</span>
                         <span style={{ fontSize: '0.75rem', fontWeight: 800, color: inc.severity > 8 ? 'var(--danger)' : 'var(--text-dim)', fontFamily: 'monospace' }}>SEV: {inc.severity}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
                         <span>ID: {inc._id?.slice(-6) || inc.id}</span>
                         <span>{timeAgo(inc.createdAt)}</span>
                      </div>
                   </motion.div>
                 ))}
               </div>
            </div>
          )}

          {selectedIncident && !isDrillingDown && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', color: '#fff' }}>{selectedIncident.title}</h3>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', marginBottom: '2rem' }}>Priority ID: IMP-{selectedIncident._id?.slice(-6) || selectedIncident.id}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                 <ImpactSimulator incident={selectedIncident} />
                 <ActionCenter incident={selectedIncident} onDispatch={onDispatch} />
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', background: isImmersive ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.2)', marginTop: 'auto' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.625rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '0.1em' }}>
            <Cpu size={12} color="var(--success)" /> Live AI Intelligence Feed
         </div>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { time: '14:02', msg: 'Gemini structured paper survey from Sector 4' },
              { time: '14:03', msg: 'Divergence detected in Medical Supply vs Need' },
              { time: '14:05', msg: 'Lateral shift recommended: Sector 2 → Sector 5' }
            ].map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                 <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>[{log.time}]</span>
                 <span style={{ color: idx === 0 ? '#fff' : 'rgba(255,255,255,0.4)' }}>{log.msg}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );

  if (viewMode === 'immersive') {
    return (
      <div style={{ position: 'relative', width: '100%', minHeight: 'calc(100vh - 4rem)', pointerEvents: 'none' }}>
        {/* Floating Stats */}
        <div style={{ position: 'absolute', top: '2rem', left: '0', pointerEvents: 'auto', background: 'rgba(25, 25, 25, 0.4)', backdropFilter: 'blur(32px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', padding: '1.25rem 2.5rem', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.625rem', color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '1rem' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
            Gemini 2.5 Engine
          </div>
          {renderStats(true)}
        </div>

        {/* Critical Unmet Alert (immersive — bottom-left floating) */}
        {criticalUnmet.length > 0 && (
          <div style={{ position: 'absolute', bottom: '2rem', left: '0', pointerEvents: 'auto', maxWidth: '380px' }}>
            {renderCriticalUnmetPanel()}
          </div>
        )}

        {/* Floating Queue Sidebar */}
        <div style={{ position: 'absolute', top: '2rem', right: '0', bottom: '2rem', width: '420px', pointerEvents: 'auto', background: 'rgba(25, 25, 25, 0.4)', backdropFilter: 'blur(32px)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 16px 40px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
          {renderPriorityQueue(true)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
      {renderCriticalUnmetPanel() && (
        <div style={{ gridColumn: 'span 12', padding: '1.5rem 2rem 0' }}>
          {renderCriticalUnmetPanel()}
        </div>
      )}
      <div className="pane" style={{ gridColumn: 'span 12', padding: '1.5rem 2rem' }}>
        {renderStats(false)}
      </div>

      <div className="pane" style={{ gridColumn: 'span 8', height: '600px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div className="pane-header">
           <MapIcon size={14} /> Live Resource Allocation Network
        </div>
        <KineticMap 
          isImmersive={false}
          incidents={incidents} 
          selectedIncident={selectedIncident} 
          activeDispatches={activeDispatches} 
          clusters={clusters}
          volunteers={volunteers}
        />
      </div>

      <div className="pane" style={{ gridColumn: 'span 4', height: '600px', display: 'flex', flexDirection: 'column', gap: '0' }}>
        {renderPriorityQueue(false)}
      </div>
    </div>
  );
}

function AnalysisTab({ incidents, volunteers }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
       <div style={{ padding: '0 1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
          Multi-Sector Intelligence Synchronized
       </div>
       <SectorPulseBoard incidents={incidents} volunteers={volunteers} />
       <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          <MisallocationRadar incidents={incidents} />
          <AIGlobalAdvisory incidents={incidents} />
       </div>
       <RedeploymentStrategy incidents={incidents} volunteers={volunteers} />
    </div>
  );
}

function IngestionTab({ onIngest, isIngesting, setIsIngesting }) {
  const [isSuccess, setIsSuccess] = useState(false);
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsIngesting(true);
    setIsSuccess(false);
    try {
      const extractedData = await extractDataFromReport(file);
      if (extractedData) {
        setIsSuccess(true);
        setTimeout(() => onIngest(extractedData), 1200);
      }
    } catch (error) {
      console.error("Ingestion failed:", error);
      alert(`AI Extraction failed: ${error.message || "Please ensure your API key is valid."}`);
    } finally {
      setIsIngesting(false);
    }
  };
  return (
    <div className="pane" style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', maxWidth: '800px', margin: '0 auto', textAlign: 'center', padding: '6rem 2rem' }}>
      <div style={{ width: '48px', height: '48px', border: '1px solid var(--border-strong)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', background: 'var(--bg-pane)' }}>
         <FileSearch size={20} color="#fff" />
      </div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Scattered Data Ingestion</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '3rem' }}>Upload paper surveys, field notes, or unstructured NGO reports. Gemini structures the chaos.</p>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} disabled={isIngesting} />
        <button className="btn btn-primary" style={{ padding: '0.75rem 2rem', background: isSuccess ? 'var(--success)' : undefined, borderColor: isSuccess ? 'var(--success)' : undefined }} disabled={isIngesting || isSuccess}>
           {isIngesting ? <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1 }}>Analyzing Report...</motion.div> : isSuccess ? <motion.div animate={{ scale: [1, 1.1, 1] }}>Extracted Successfully</motion.div> : 'Select Field Report'}
        </button>
      </div>
      {isIngesting && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '2rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>Connecting to Gemini 1.5 Flash Vision Layer...</motion.div>}
      {isSuccess && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '2rem', color: 'var(--success)', fontSize: '0.8125rem' }}>Incident parsed. Redirecting to Command Center...</motion.div>}
    </div>
  );
}

function AIRadarTab({ clusters, incidents }) {
  const hotspots = clusters.hotspots || [];
  const [anomalyReport, setAnomalyReport] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Manual Trigger: Definitively kills rate-limit looping by putting control in the user's hands
  const triggerScan = async () => {
    setIsScanning(true);
    if (hotspots.length === 0) {
      setAnomalyReport("Network Integrity Optimal.\nNo significant spatial anomalies detected outside of known clusters in the current time-window.");
      setIsScanning(false);
      return;
    }
    const report = await getNetworkAnomalyAnalysis(hotspots);
    setAnomalyReport(report);
    setIsScanning(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div className="pane">
        <div className="pane-header"><Radar size={14} /> AI Cluster Analysis [DBSCAN]</div>
        <div style={{ padding: '2rem' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Machine learning has identified {hotspots.length} high-density clusters of misallocated resources.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {hotspots.slice(0, 5).map((c, i) => (
               <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#fff' }}>{c.name || `Hotspot Cluster #${c.cluster}`}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--error)' }}>Intensity: {c.avgSeverity?.toFixed(1) || 'N/A'}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Centroid: {c.lat?.toFixed(4)}, {c.lng?.toFixed(4)} ({c.count} incidents)</div>
               </div>
            ))}
            {hotspots.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8125rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                No significant clusters detected. Awaiting more tactical data...
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="pane" style={{ background: 'linear-gradient(180deg, var(--bg-pane) 0%, rgba(20,20,20,0.8) 100%)' }}>
          <div className="pane-header"><Zap size={14} /> Anomaly Detection</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem', textAlign: 'center' }}>
             {isScanning ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                   <div style={{ position: 'relative' }}>
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--success)' }}
                      />
                      <Zap size={20} color="var(--success)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                   </div>
                   <span style={{ color: 'var(--text-dim)', fontSize: '0.8125rem', letterSpacing: '0.05em' }}>RUNNING NEURAL SCAN...</span>
                </div>
             ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                   <ShieldCheck size={48} color={!anomalyReport ? 'var(--text-dim)' : anomalyReport.toLowerCase().includes('optimal') ? 'var(--success)' : 'var(--warning)'} style={{ marginBottom: '1.5rem', opacity: 0.7 }} />
                   
                   {!anomalyReport ? (
                      <h3 style={{ color: 'var(--text-dim)', fontSize: '0.875rem', fontWeight: 400 }}>AI Scanner Offline. Awaiting manual trigger.</h3>
                   ) : (
                      anomalyReport.split('\n').map((line, idx) => (
                        <h3 key={idx} style={{ 
                           color: idx === 0 ? '#fff' : 'var(--text-dim)', 
                           marginBottom: '0.5rem',
                           fontSize: idx === 0 ? '1.125rem' : '0.875rem',
                           fontWeight: idx === 0 ? 600 : 400
                        }}>{line}</h3>
                      ))
                   )}

                   <button 
                     onClick={triggerScan} 
                     style={{ marginTop: '2rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                     onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                     onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                   >
                     <Zap size={14} /> Scan Data Stream
                   </button>
                </motion.div>
             )}
          </div>
      </div>
    </div>
  );
}

function BeneficiariesTab({ beneficiaries = [], onView }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const itemsPerPage = 15;

  // 1. Filtering Logic (Memoized)
  const filteredItems = useMemo(() => {
    if (!beneficiaries) return [];
    return beneficiaries.filter(b => {
      if (!b) return false;
      const firstName = b.firstName || '';
      const lastName = b.lastName || '';
      const full = (firstName + ' ' + lastName).toLowerCase();
      const aadhar = b.aadharMasked || '';
      
      const matchesSearch = full.includes(searchTerm.toLowerCase()) || aadhar.includes(searchTerm);
      const matchesGender = genderFilter === 'ALL' || b.gender?.toLowerCase() === genderFilter.toLowerCase() || (genderFilter === 'M' && b.gender === 'male') || (genderFilter === 'F' && b.gender === 'female');
      return matchesSearch && matchesGender;
    });
  }, [beneficiaries, searchTerm, genderFilter]);

  // 2. Reset back to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter]);

  // 3. Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Jump Input State
  const [jumpVal, setJumpVal] = useState('');
  const [activeJump, setActiveJump] = useState(null); // 'top' | 'bottom' | null

  const getRange = () => {
    const delta = 2; // Window size
    const range = [];
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i < right)) {
        range.push(i);
      }
    }
    const finalRange = [];
    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          finalRange.push(l + 1);
        } else if (i - l !== 1) {
          finalRange.push('...');
        }
      }
      finalRange.push(i);
      l = i;
    }
    return finalRange;
  };

  const handleJump = (e) => {
    if (e.key === 'Enter') {
      const p = parseInt(jumpVal);
      if (p >= 1 && p <= totalPages) {
        setCurrentPage(p);
        setActiveJump(null);
        setJumpVal('');
      }
    } else if (e.key === 'Escape') {
      setActiveJump(null);
      setJumpVal('');
    }
  };

  const renderPagination = (pos) => (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <button className="btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === 1 ? 0.3 : 1 }}>Prev</button>
      
      {getRange().map((n, idx) => {
        if (n === '...') {
          const jumpId = `${pos}-${idx}`;
          const isThisJumping = activeJump === jumpId;
          return isThisJumping ? (
            <input 
              key={`jump-input-${jumpId}`}
              type="text"
              autoFocus
              placeholder="Pg"
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              onKeyDown={handleJump}
              onBlur={() => {
                setTimeout(() => setActiveJump(null), 200);
              }}
              style={{ width: '40px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', color: '#fff', fontSize: '0.75rem', padding: '0.2rem', textAlign: 'center', borderRadius: '4px' }}
            />
          ) : (
            <span 
              key={`dots-${jumpId}`} 
              onClick={() => {
                setActiveJump(jumpId);
                setJumpVal('');
              }}
              style={{ color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', padding: '0 0.5rem', userSelect: 'none' }}
              title="Click to jump to page"
            >...</span>
          );
        }
        return (
          <button 
            key={`page-${n}`} 
            onClick={() => setCurrentPage(n)}
            className="btn"
            style={{ 
              padding: '0.3rem 0.6rem', 
              fontSize: '0.75rem', 
              background: currentPage === n ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
              border: currentPage === n ? 'none' : '1px solid var(--border-subtle)',
              color: currentPage === n ? '#000' : '#fff'
            }}
          >
            {n}
          </button>
        );
      })}

      <button className="btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === totalPages ? 0.3 : 1 }}>Next</button>
    </div>
  );

  return (
    <div className="pane">
      <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={14}/> Normalized Beneficiary Directory</div>
        
        {/* Search & Filter Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
             <Search size={12} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-dim)' }} />
             <input 
                type="text" 
                placeholder="Search name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0.4rem 1rem 0.4rem 2rem', color: '#fff', fontSize: '0.75rem', minWidth: '180px' }}
             />
           </div>
           
           <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
             <Filter size={12} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-dim)' }} />
             <select 
               value={genderFilter} 
               onChange={(e) => setGenderFilter(e.target.value)}
               style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0.4rem 1rem 0.4rem 2rem', color: '#fff', fontSize: '0.75rem', appearance: 'none', cursor: 'pointer' }}
             >
               <option value="ALL">All Genders</option>
               <option value="M">Male</option>
               <option value="F">Female</option>
               <option value="O">Other</option>
             </select>
           </div>

           {renderPagination('top')}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)', textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '1rem', fontWeight: 500, width: '40px' }}>#</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Name</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Age/Gender</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Location</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>ID (Aadhaar)</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Registration</th>
              <th style={{ padding: '1rem', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? currentItems.map((b, idx) => (
              <tr key={b._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                   {(currentPage - 1) * itemsPerPage + idx + 1}
                </td>
                <td style={{ padding: '1rem', color: '#fff' }}>{b.firstName} {b.lastName}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{b.age} / {b.gender}</td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{b.village || b.geo?.formattedAddress?.split(',')[0] || b.rawLocation || 'Unknown Region'}</td>
                <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--success)' }}>{b.aadharMasked ? `XXXX-XXXX-${b.aadharMasked}` : 'N/A'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-dim)' }}>{b.registeredAt ? new Date(b.registeredAt).toLocaleDateString() : (b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'N/A')}</td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button 
                    onClick={() => onView(b)}
                    className="btn-icon" 
                    title="View Profile" 
                    style={{ background: 'rgba(0, 191, 255, 0.1)', border: '1px solid rgba(0, 191, 255, 0.2)' }}
                  >
                    <Eye size={14} color="var(--accent-primary)" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Search size={32} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                  <div>No matching beneficiary records found.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)' }}>
        {renderPagination('bottom')}
      </div>
    </div>
  );
}

function VolunteersTab({ volunteers = [], onView }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const itemsPerPage = 15;

  // 1. Filtering Logic (Memoized)
  const filteredItems = useMemo(() => {
    if (!volunteers) return [];
    return volunteers.filter(v => {
      if (!v) return false;
      const name = v.name || '';
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [volunteers, searchTerm, statusFilter]);

  // 2. Reset back to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // 3. Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const currentItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [jumpVal, setJumpVal] = useState('');
  const [activeJump, setActiveJump] = useState(null);

  const getRange = () => {
    const delta = 2;
    const range = [];
    const left = currentPage - delta;
    const right = currentPage + delta + 1;
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i < right)) {
        range.push(i);
      }
    }
    const finalRange = [];
    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          finalRange.push(l + 1);
        } else if (i - l !== 1) {
          finalRange.push('...');
        }
      }
      finalRange.push(i);
      l = i;
    }
    return finalRange;
  };

  const handleJump = (e) => {
    if (e.key === 'Enter') {
      const p = parseInt(jumpVal);
      if (p >= 1 && p <= totalPages) {
        setCurrentPage(p);
        setActiveJump(null);
        setJumpVal('');
      }
    } else if (e.key === 'Escape') {
      setActiveJump(null);
      setJumpVal('');
    }
  };

  const renderPagination = (pos) => (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <button className="btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === 1 ? 0.3 : 1 }}>Prev</button>
      
      {getRange().map((n, idx) => {
        if (n === '...') {
          const jumpId = `${pos}-${idx}`;
          const isThisJumping = activeJump === jumpId;
          return isThisJumping ? (
            <input 
              key={`jump-input-${jumpId}`}
              type="text"
              autoFocus
              placeholder="Pg"
              value={jumpVal}
              onChange={(e) => setJumpVal(e.target.value)}
              onKeyDown={handleJump}
              onBlur={() => {
                setTimeout(() => setActiveJump(null), 200);
              }}
              style={{ width: '40px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--accent-primary)', color: '#fff', fontSize: '0.75rem', padding: '0.2rem', textAlign: 'center', borderRadius: '4px' }}
            />
          ) : (
            <span 
              key={`dots-${jumpId}`} 
              onClick={() => {
                setActiveJump(jumpId);
                setJumpVal('');
              }}
              style={{ color: 'var(--text-dim)', fontSize: '0.75rem', cursor: 'pointer', padding: '0 0.5rem', userSelect: 'none' }}
              title="Click to jump to page"
            >...</span>
          );
        }
        return (
          <button 
            key={`page-${n}`} 
            onClick={() => setCurrentPage(n)}
            className="btn"
            style={{ 
              padding: '0.3rem 0.6rem', 
              fontSize: '0.75rem', 
              background: currentPage === n ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
              border: currentPage === n ? 'none' : '1px solid var(--border-subtle)',
              color: currentPage === n ? '#000' : '#fff'
            }}
          >
            {n}
          </button>
        );
      })}

      <button className="btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: currentPage === totalPages ? 0.3 : 1 }}>Next</button>
    </div>
  );

  return (
    <div className="pane">
      <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HandHeart size={14}/> Live Responder Network</div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
           <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
             <Search size={12} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-dim)' }} />
             <input 
                type="text" 
                placeholder="Search responders..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0.4rem 1rem 0.4rem 2rem', color: '#fff', fontSize: '0.75rem', minWidth: '180px' }}
             />
           </div>
           
           <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
             <Filter size={12} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-dim)' }} />
             <select 
               value={statusFilter} 
               onChange={(e) => setStatusFilter(e.target.value)}
               style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '0.4rem 1rem 0.4rem 2rem', color: '#fff', fontSize: '0.75rem', appearance: 'none', cursor: 'pointer' }}
             >
               <option value="ALL">All Status</option>
               <option value="Active">Active</option>
               <option value="Deployed">Deployed</option>
             </select>
           </div>

           {renderPagination('top')}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-strong)', textAlign: 'left', color: 'var(--text-dim)' }}>
              <th style={{ padding: '1rem', fontWeight: 500, width: '40px' }}>#</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Name</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Assigned Location</th>
              <th style={{ padding: '1rem', fontWeight: 500 }}>Capabilities</th>
              <th style={{ padding: '1rem', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? currentItems.map((v, idx) => (
              <tr key={v._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                   {(currentPage - 1) * itemsPerPage + idx + 1}
                </td>
                <td style={{ padding: '1rem', color: '#fff' }}>{v.name}</td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: v.status === 'Deployed' ? '#34d399' : '#fff' }}>
                    <div style={{ width: '4px', height: '4px', background: v.status === 'Deployed' ? '#34d399' : '#fff', borderRadius: '50%' }}/> 
                    {v.status}
                  </div>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{v.locationId?.name || 'Unassigned Hub'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.75rem' }}>{v.skills?.join(', ') || 'Generalist'}</td>
                <td style={{ padding: '1rem', textAlign: 'right' }}>
                  <button 
                    onClick={() => onView(v)}
                    className="btn-icon" 
                    title="View Profile" 
                    style={{ background: 'rgba(0, 191, 255, 0.1)', border: '1px solid rgba(0, 191, 255, 0.2)' }}
                  >
                    <Eye size={14} color="var(--accent-primary)" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <Search size={32} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                  <div>No matching responders found in the registry.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)' }}>
        {renderPagination('bottom')}
      </div>
    </div>
  );
}
