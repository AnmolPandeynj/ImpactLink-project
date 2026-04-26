import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Database, FileText, CheckCircle2, AlertCircle, 
  ChevronRight, MapPin, Loader2, Sparkles, X, Filter,
  Globe, LayoutGrid, RotateCcw, Search
} from 'lucide-react';
import { beneficiaryApi } from '../../../services/beneficiaryApi';

// ─── STABLE SUB-COMPONENTS ───

const CustomSelect = ({ value, options, onChange, placeholder, multi }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter out Excel artifacts like "__EMPTY" and apply search
  const filteredOptions = useMemo(() => {
    return options
      .filter(opt => opt && !opt.startsWith('__EMPTY'))
      .filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);
  
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.03)', 
          color: (value && (Array.isArray(value) ? value.length > 0 : true)) ? '#fff' : 'rgba(255,255,255,0.3)', 
          border: '1px solid rgba(255,255,255,0.1)', 
          borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'all 0.2s ease', borderColor: isOpen ? 'var(--accent-brand)' : 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {Array.isArray(value) ? (value.length > 0 ? value.join(' + ') : placeholder) : (value || placeholder)}
          </span>
          {multi && <div style={{ flexShrink: 0, padding: '2px 4px', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-brand)', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 900 }}>MULTI</div>}
        </div>
        <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s ease', opacity: 0.5 }} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              style={{ 
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, 
                background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.15)', 
                borderRadius: '14px', zIndex: 1001, overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(20px)'
              }}
            >
              {/* Search Bar inside Dropdown */}
              <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                 <Search size={14} color="rgba(255,255,255,0.3)" />
                 <input 
                   autoFocus
                   placeholder="Search columns..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   style={{ background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', width: '100%', outline: 'none' }}
                 />
              </div>

              <div style={{ maxHeight: '250px', overflowY: 'auto', padding: '4px' }}>
                {filteredOptions.length > 0 ? filteredOptions.map(opt => {
                  const isSelected = Array.isArray(value) ? value.includes(opt) : value === opt;
                  return (
                    <div 
                      key={opt} 
                      onClick={() => {
                        const currentArray = Array.isArray(value) ? value : (value ? [value] : []);
                        const newValue = multi 
                          ? (isSelected ? currentArray.filter(v => v !== opt) : [...currentArray, opt])
                          : opt;
                        if (!multi) setIsOpen(false);
                        onChange(newValue);
                      }} 
                      style={{ 
                        padding: '0.7rem 0.75rem', fontSize: '0.8rem', color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)', 
                        cursor: 'pointer', borderRadius: '8px', marginBottom: '2px',
                        transition: 'all 0.2s',
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent'}
                    >
                      <span style={{ fontWeight: isSelected ? 700 : 400 }}>{opt}</span>
                      {isSelected && <CheckCircle2 size={12} color="var(--accent-brand)" />}
                    </div>
                  );
                }) : (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
                    No matching columns
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ZoneDashboard = ({ regions, zoneStates, onSelectZone }) => (
  <div style={{ marginTop: '2rem' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
      {regions.map((region, idx) => {
        const state = zoneStates[idx] || {};
        const isComplete = state.status === 'complete';
        return (
          <motion.div 
            key={idx}
            whileHover={{ y: -5, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}
            onClick={() => onSelectZone(idx)}
            style={{ 
              padding: '1.5rem', background: isComplete ? 'rgba(16, 185, 129, 0.03)' : 'rgba(255,255,255,0.02)', 
              border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: '20px', cursor: 'pointer', transition: 'all 0.3s ease',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {isComplete && <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: '#10b981' }} />}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${region.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin size={20} color={region.color} />
              </div>
              {isComplete ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={14} color="#10b981" /><span style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 800 }}>SYNCED</span></div>
              ) : (
                <div style={{ padding: '0.25rem 0.6rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', color: 'var(--text-dim)', fontSize: '0.65rem', fontWeight: 800 }}>AWAITING DATA</div>
              )}
            </div>
            <h4 style={{ color: '#fff', margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{region.name}</h4>
            {isComplete ? (
               <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{state.datasetName}</div>
                  <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>{state.count} Records</div>
               </div>
            ) : (
               <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: 0, lineHeight: '1.4' }}>Map tactical population feed for this region...</p>
            )}
            {isComplete && <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.65rem', color: 'var(--accent-brand)', fontWeight: 700 }}><RotateCcw size={10} /> RE-MAP DATA</div>}
          </motion.div>
        );
      })}
    </div>
  </div>
);

const SourceSelector = ({ datasets, onFileSelect, onUploadClick, activeZoneName }) => (
  <div style={{ marginTop: '2rem' }}>
    <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '16px' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-brand)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.1em' }}>Ingestion Context</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem' }}>{activeZoneName}</div>
          </div>
          <div style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}><Globe size={24} color="var(--accent-brand)" /></div>
       </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '2rem' }}>
      <motion.div whileHover={{ scale: 1.02 }} style={{ padding: '3rem 2rem', background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', textAlign: 'center' }} onClick={onUploadClick}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Upload size={36} color="var(--primary)" /></div>
        <div><h4 style={{ color: '#fff', margin: '0 0 0.5rem 0' }}>Upload New Feed</h4><p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', maxWidth: '200px' }}>Select an Excel or CSV file dedicated to this zone.</p></div>
      </motion.div>
      <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}><Database size={18} color="var(--primary)" /><h4 style={{ color: '#fff', margin: 0 }}>Existing Library</h4></div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
          {datasets.map(ds => (
            <div key={ds._id} onClick={() => onFileSelect(ds)} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
              <div style={{ flex: 1 }}><div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.25rem' }}>{ds.name}</div><div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{ds.sourceFile?.rowCount || '---'} Records</div></div>
              <ChevronRight size={14} color="#fff" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ColumnMapper = ({ preview, mapping, setMapping, geoMode, setGeoMode, startProcessing, activeZoneName }) => (
  <div style={{ marginTop: '1.5rem' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div><h3 style={{ color: '#fff', margin: 0 }}>Mapping Architecture: {activeZoneName}</h3><p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Resolve columns for this regional tactical feed.</p></div>
        <button onClick={startProcessing} style={{ padding: '0.8rem 2rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 5px 15px rgba(79, 70, 229, 0.2)' }}>Start Geocoding Pipeline</button>
     </div>
     <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem' }}>
        <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', color: '#fff' }}>
               <thead style={{ background: 'rgba(255,255,255,0.03)' }}><tr>{preview?.headers.slice(0, 10).map(h => <th key={h} style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>)}</tr></thead>
               <tbody>{preview?.preview.slice(0, 20).map((row, i) => (<tr key={i}>{preview.headers.slice(0, 10).map(h => <td key={h} style={{ padding: '1rem', opacity: 0.7, borderBottom: '1px solid rgba(255,255,255,0.02)' }}>{row[h]}</td>)}</tr>))}</tbody>
           </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '600px', overflowY: 'auto' }}>
           {[
             { label: 'Identity & Vital Statistics', fields: ['name', 'age', 'gender', 'phone'] },
             { label: 'Field Geography', modeToggle: true, fields: geoMode === 'coordinates' ? ['lat', 'lng'] : ['address'] },
             { label: 'Socio-Economic Factors', fields: ['incomeRange', 'familySize', 'housingCondition', 'occupation'] }
           ].map(section => (
             <div key={section.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(99, 102, 241, 0.2)', paddingBottom: '0.5rem' }}><h5 style={{ color: 'var(--accent-brand)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', margin: 0, letterSpacing: '0.1em' }}>{section.label}</h5>
                  {section.modeToggle && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
                      {[{ id: 'address', label: 'Address' }, { id: 'coordinates', label: 'GPS' }].map(mode => (<button key={mode.id} onClick={() => setGeoMode(mode.id)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', border: 'none', borderRadius: '4px', cursor: 'pointer', background: geoMode === mode.id ? 'var(--accent-brand)' : 'transparent', color: geoMode === mode.id ? '#fff' : 'var(--text-dim)', fontWeight: 700, transition: 'all 0.2s' }}>{mode.label}</button>))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {section.fields.map(field => (
                    <div key={field}><label style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>{field.replace(/([A-Z])/g, ' $1')}</label>
                      <CustomSelect value={mapping[field]} options={preview?.headers || []} placeholder="Select Column..." onChange={(val) => setMapping({...mapping, [field]: val})} multi={field === 'name' || (field === 'address' && geoMode === 'address')} />
                    </div>
                  ))}
                </div>
             </div>
           ))}
        </div>
     </div>
  </div>
);

// ─── MAIN COMPONENT ───

const Step3Beneficiaries = ({ data, update }) => {
  const [subView, setSubView] = useState('dashboard');
  const [activeZoneIndex, setActiveZoneIndex] = useState(null);
  const [zoneStates, setZoneStates] = useState(data.beneficiarySummary?.zoneStats || {});
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [geoMode, setGeoMode] = useState('address');
  const [status, setStatus] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { beneficiaryApi.getDatasets().then(setDatasets); }, []);

  const syncToParent = (newZoneStates) => {
    const totalCount = Object.values(newZoneStates).reduce((acc, curr) => acc + (curr.count || 0), 0);
    update('beneficiaries', { 
      beneficiarySummary: { 
        zoneStats: newZoneStates,
        totalCount,
        lastUpdated: new Date()
      } 
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', 'dev-user-001');
    const zoneName = data.regions[activeZoneIndex]?.name || 'UnknownZone';
    formData.append('name', `${zoneName}_${file.name.split('.')[0]}`);
    try {
      const ds = await beneficiaryApi.uploadDataset(formData);
      setSelectedDataset(ds);
      const pre = await beneficiaryApi.getPreview(ds._id);
      setPreview(pre);
      setMapping(zoneStates[activeZoneIndex]?.mapping || ds.columnMapping || pre.suggestions || {});
      setSubView('mapping');
    } catch (err) { setError('Upload failed: ' + (err.response?.data?.message || err.message)); } 
    finally { setIsUploading(false); e.target.value = ''; }
  };

  const startProcessing = async () => {
    try {
      setError(null);
      await beneficiaryApi.processDatasetV2(selectedDataset._id, mapping, data._id, activeZoneIndex);
      setSubView('processing');
      pollStatus();
    } catch (err) { 
      console.error('[PROCESSING ERROR]', err);
      const msg = err.response?.data?.message || err.message || 'Processing failed';
      setError(msg); 
    }
  };

  const pollStatus = () => {
    const interval = setInterval(async () => {
      try {
        const stats = await beneficiaryApi.getStatus(selectedDataset._id);
        setStatus(stats);
        if (stats.status === 'complete') {
          clearInterval(interval);
          const newStates = { ...zoneStates, [activeZoneIndex]: { status: 'complete', count: stats.totalRows, geocodedCount: stats.geocodedCount, datasetId: selectedDataset._id, datasetName: selectedDataset.name, mapping: mapping } };
          setZoneStates(newStates);
          syncToParent(newStates);
          setSubView('dashboard');
        }
      } catch (err) { clearInterval(interval); }
    }, 2000);
  };

  return (
    <div style={{ minHeight: '500px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.6rem', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '12px' }}><Globe size={22} color="var(--primary)" /></div>
          <div><h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Zonal Ingestion Orchestrator</h2><p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0 }}>Phase 3: Tactical Population Alignment</p></div>
        </div>
        {subView !== 'dashboard' && <button onClick={() => setSubView('dashboard')} style={{ padding: '0.6rem 1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Cancel & Return to Zones</button>}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={16} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={14} /></button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {subView === 'dashboard' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <div><h3 style={{ color: '#fff', margin: 0 }}>Mission Active Regions</h3><p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>Select a zone to feed tactical beneficiary data.</p></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Aggregate Project Readiness</div><div style={{ padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#10b981', fontWeight: 800, fontSize: '0.9rem' }}>{Object.values(zoneStates).reduce((acc, s) => acc + (s.count || 0), 0)} Total Beneficiaries</div></div>
            </div>
            <ZoneDashboard regions={data.regions} zoneStates={zoneStates} onSelectZone={(idx) => { setActiveZoneIndex(idx); setSubView('source'); }} />
          </motion.div>
        )}
        {subView === 'source' && (
          <motion.div key="source" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <SourceSelector datasets={datasets} activeZoneName={data.regions[activeZoneIndex]?.name} onUploadClick={() => document.getElementById('bene-upload').click()} onFileSelect={(ds) => {
              setSelectedDataset(ds);
              beneficiaryApi.getPreview(ds._id).then(pre => { setPreview(pre); setMapping(zoneStates[activeZoneIndex]?.mapping || ds.columnMapping || pre.suggestions || {}); setSubView('mapping'); });
            }} />
            <input id="bene-upload" type="file" hidden onChange={handleFileUpload} accept=".csv,.xlsx,.xls" />
          </motion.div>
        )}
        {subView === 'mapping' && (
          <motion.div key="mapping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <ColumnMapper preview={preview} mapping={mapping} setMapping={setMapping} geoMode={geoMode} setGeoMode={setGeoMode} startProcessing={startProcessing} activeZoneName={data.regions[activeZoneIndex]?.name} />
          </motion.div>
        )}
        {subView === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ textAlign: 'center', padding: '6rem 0' }}>
               <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 2rem' }}><Loader2 size={80} color="var(--primary)" className="animate-spin" style={{ opacity: 0.2 }} /><div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Sparkles size={32} color="var(--primary)" /></div></div>
               <h3 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 800 }}>Geocoding {data.regions[activeZoneIndex]?.name}</h3>
               <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>
                      Processed: {status?.processedCount || 0} / {status?.totalRows || 0} 
                      {status?.failedCount > 0 && <span style={{ color: '#ef4444', marginLeft: '0.5rem' }}>({status.failedCount} failed)</span>}
                    </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 800 }}>
                      {Math.round(((status?.processedCount || 0) / (status?.totalRows || 1)) * 100)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${((status?.processedCount || 0) / (status?.totalRows || 1)) * 100}%` }} style={{ height: '100%', background: 'var(--primary)', boxShadow: '0 0 15px var(--primary)' }} />
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isUploading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, borderRadius: '24px' }}>
         <div style={{ textAlign: 'center' }}><Loader2 size={40} color="var(--primary)" className="animate-spin" style={{ marginBottom: '1rem' }} /><div style={{ color: '#fff', fontWeight: 700 }}>Uploading Tactical Feed...</div></div>
      </div>}
    </div>
  );
};

export default Step3Beneficiaries;
