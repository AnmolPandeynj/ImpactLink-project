import React, { useState, useMemo, useRef } from 'react';
import { 
  Network, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Map as MapIcon, 
  Clock, 
  Users, 
  Package, 
  Target,
  AlertOctagon,
  LifeBuoy,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createProject, updateProject, fetchProjects } from '../../../services/api';
import { useProject } from '../../../context/ProjectContext';

// Step Components
import Step1Identity from './Step1Identity';
import Step2Geography from './Step2Geography';
import Step3Beneficiaries from './Step3Beneficiaries'; // NEW
import Step4Timeline from './Step3Timeline'; // RENAMED/SHIFTED
import Step5Personnel from './Step4Personnel'; // SHIFTED
import Step6Roster from './Step5Roster'; // SHIFTED
import Step7Resources from './Step6Resources'; // SHIFTED

const STEPS = [
  { id: 'identity', title: 'Mission Identity', icon: Target, subtitle: 'Define mission scope and strategy' },
  { id: 'geography', title: 'Geographic Intelligence', icon: MapIcon, subtitle: 'Target specific operational zones' },
  { id: 'beneficiaries', title: 'Impact Scope', icon: Sparkles, subtitle: 'Ingest and resolve population data' }, // NEW
  { id: 'timeline', title: 'Temporal Planning', icon: Clock, subtitle: 'Set duration and phase windows' },
  { id: 'personnel', title: 'Human Capital', icon: Users, subtitle: 'Define responder requirements' },
  { id: 'roster', title: 'Tactical Roster', icon: Check, subtitle: 'Draft specific individuals' },
  { id: 'resources', title: 'Resource Architecture', icon: Package, subtitle: 'Structure hierarchical supplies' }
];

export default function ProjectWizard({ onClose, initialData = null }) {
  const { refreshProjects, switchProject } = useProject();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isEditMode = !!initialData;

  // Unified Form State (Hydrated for Legacy Projects)
  const defaultData = {
    name: '',
    description: '',
    operatingMode: 'assisted',
    allocationStrategy: 'ai',
    metadata: {
      priority: 'Medium',
      beneficiaryType: '',
      approvalWorkflow: 'Standard',
      notificationMethod: 'Email+App',
      notificationsEnabled: true
    },
    scope: 'District',
    regions: [],
    timeline: {
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      phases: []
    },
    volunteerTargets: {
      requiredSkills: []
    },
    assignedRoster: [], 
    hierarchicalSupplies: [
      { category: 'Food & Water', items: [{ type: 'Basic Rations', unit: 'kits', targetQuantity: 1000 }] },
      { category: 'Medical', items: [{ type: 'First Aid Kits', unit: 'units', targetQuantity: 500 }] }
    ]
  };

  const [formData, setFormData] = useState(
    initialData ? JSON.parse(JSON.stringify({ ...defaultData, ...initialData })) : JSON.parse(JSON.stringify(defaultData))
  );

  // Store the initial state to detect changes
  const originalData = useRef(JSON.parse(JSON.stringify(formData)));

  // Check if form is modified (Dirty State Detection)
  const isDirty = useMemo(() => {
    try {
      // STRATEGIC: Safe comparison for complex state objects.
      // Falls back to true if stringification fails to prevent "Blank Screen" crashes.
      return JSON.stringify(formData) !== JSON.stringify(originalData.current);
    } catch (e) {
      console.warn('[WIZARD] Dirty state detection failed, defaulting to unsaved changes.', e);
      return true; 
    }
  }, [formData]);

  const updateFormData = (stepId, data) => {
    // Specialized handling for step components that might pass partial data
    setFormData(prev => ({ ...prev, ...data }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      setError(null);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      setError("Project Name is mandatory.");
      setCurrentStep(0);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // --- STRATEGIC SANITIZATION ---
      // 1. Filter out empty phases (ones without a name)
      const sanitizedPhases = formData.timeline.phases.filter(p => p.name.trim() !== '');
      
      // 2. Filter out empty resource categories and items
      const sanitizedSupplies = formData.hierarchicalSupplies
        .map(cat => ({
          ...cat,
          // Filter out items without a type
          items: cat.items.filter(item => item.type.trim() !== '')
        }))
        // Filter out categories without a name OR with zero valid items
        .filter(cat => cat.category.trim() !== '' && cat.items.length > 0);

      const finalPayload = {
        ...formData,
        timeline: {
          ...formData.timeline,
          phases: sanitizedPhases
        },
        hierarchicalSupplies: sanitizedSupplies
      };

      let result;
      if (isEditMode && initialData._id) {
        result = await updateProject(initialData._id, finalPayload);
      } else {
        result = await createProject(finalPayload);
      }

      await refreshProjects();
      switchProject(result._id);
      onClose();
    } catch (err) {
      setError(err.message || 'Workflow initialization failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <Step1Identity data={formData} update={updateFormData} />;
      case 1: return <Step2Geography data={formData} update={updateFormData} />;
      case 2: return <Step3Beneficiaries data={formData} update={updateFormData} />;
      case 3: return <Step4Timeline data={formData} update={updateFormData} />;
      case 4: return <Step5Personnel data={formData} update={updateFormData} />;
      case 5: return <Step6Roster data={formData} update={updateFormData} />;
      case 6: return <Step7Resources data={formData} update={updateFormData} />;
      default: return null;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'var(--bg-main)', display: 'flex', flexDirection: 'column'
      }}
    >
      {/* Top Console Bar */}
      <header style={{ 
        height: '4rem', padding: '0 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.5rem' }}>
            <X size={20} />
          </button>
          <div style={{ width: '1px', height: '1.5rem', background: 'rgba(255,255,255,0.1)' }} />
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', margin: 0 }}>Strategic Orchestrator: <span style={{ color: 'var(--primary)' }}>{isEditMode ? 'Refine Active Strategy' : 'New Project Environment'}</span></h2>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <AnimatePresence>
            {isEditMode && isDirty && (
              <motion.button
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.1)',
                  color: '#10B981', padding: '0.5rem 1rem', borderRadius: '8px',
                  fontSize: '0.8rem', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s', height: 'fit-content'
                }}
              >
                {isSubmitting ? 'Syncing...' : 'Update Strategy'}
              </motion.button>
            )}
          </AnimatePresence>
          <div style={{ 
            fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', 
            alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
            background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <LifeBuoy size={14} /> Documentation & Standards
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Navigator (Stepper) */}
        <aside style={{ 
          width: '320px', borderRight: '1px solid rgba(255,255,255,0.05)', 
          background: 'rgba(0,0,0,0.2)', padding: '2rem',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '2rem' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ padding: '0.6rem', background: 'var(--primary-glow)', borderRadius: '10px' }}>
                  <Network size={22} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>{isEditMode ? 'Strategic Refinement' : 'Project Initialization'}</h3>
             </div>
             <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: '1.5' }}>
               {isEditMode ? 'Adjust the operational parameters of this active mission.' : 'Configure the parameters for your new mission intelligence environment.'}
             </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {STEPS.map((step, idx) => {
              const isCompleted = !isEditMode && idx < currentStep;
              const isActive = idx === currentStep;
              return (
                <div 
                  key={step.id} 
                  style={{ 
                    padding: '1rem', borderRadius: '12px', border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : 'transparent',
                    background: isActive ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                    display: 'flex', gap: '1rem', cursor: (isEditMode || idx <= currentStep) ? 'pointer' : 'default',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => (isEditMode || idx <= currentStep) && setCurrentStep(idx)}
                >
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: isCompleted ? 'var(--success)' : isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                    border: isActive ? '4px solid rgba(79, 70, 229, 0.2)' : 'none'
                  }}>
                    {isCompleted ? <Check size={16} /> : idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400, color: isCompleted || isActive ? '#fff' : 'var(--text-dim)' }}>{step.title}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '2px' }}>{step.subtitle}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {error && (
            <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: 'var(--error)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <AlertOctagon size={14} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
        </aside>

        {/* Right content (Form area) */}
        <main style={{ flex: 1, overflowY: 'auto', background: 'radial-gradient(circle at top right, rgba(79, 70, 229, 0.03), transparent)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 6rem' }}>
             <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{ marginBottom: '4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                       {React.createElement(STEPS[currentStep].icon, { size: 24 })}
                       <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>{isEditMode ? 'Refinement Phase' : 'Deployment Phase'} {currentStep + 1}</span>
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>{isEditMode ? `Adjust ${STEPS[currentStep].title}` : STEPS[currentStep].title}</h1>
                    <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>{STEPS[currentStep].subtitle}</p>
                  </div>

                  {renderStep()}

                  {/* Navigation Actions */}
                  <div style={{ marginTop: '5rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '1.5rem' }}>
                    <button 
                      onClick={handleNext} 
                      disabled={isSubmitting} 
                      className="btn-primary" 
                      style={{ 
                        padding: '1rem 3.5rem', borderRadius: '100px', fontSize: '1rem', fontWeight: 600,
                        boxShadow: '0 10px 40px rgba(79, 70, 229, 0.3)'
                      }}
                    >
                      {isSubmitting ? 'Syncing...' : currentStep === STEPS.length - 1 ? (isEditMode ? 'Update Strategy & Synchronize' : 'Compute & Launch Environment') : 'Continue'}
                    </button>
                    
                    {currentStep > 0 && (
                      <button 
                        onClick={handleBack} 
                        style={{ 
                          padding: '1rem 2rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', 
                          color: '#fff', borderRadius: '100px', cursor: 'pointer', fontSize: '1rem' 
                        }}
                      >
                        Back
                      </button>
                    )}

                    <button 
                      onClick={onClose}
                      style={{ 
                        marginLeft: 'auto', padding: '1rem', background: 'transparent', border: 'none', 
                        color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.9rem' 
                      }}
                    >
                      Cancel Setup
                    </button>
                  </div>
                </motion.div>
             </AnimatePresence>
          </div>
        </main>
      </div>
    </motion.div>
  );
}
