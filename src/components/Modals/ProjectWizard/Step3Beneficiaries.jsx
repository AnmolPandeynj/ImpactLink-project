import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Database, FileText, CheckCircle2, AlertCircle, 
  ChevronRight, MapPin, Loader2, Sparkles, X, Filter 
} from 'lucide-react';
import { beneficiaryApi } from '../../../services/beneficiaryApi';

const Step3Beneficiaries = ({ data, update }) => {
  const [subView, setSubView] = useState('source'); // source, mapping, processing, resolution, summary
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [status, setStatus] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  // ... (rest of states)

  useEffect(() => {
    loadDatasets();
  }, []);

  const loadDatasets = async () => {
    try {
      const list = await beneficiaryApi.getDatasets();
      setDatasets(list);
    } catch (err) {
      setError('Failed to load datasets library');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.split('.')[0]);
    formData.append('uploadedBy', 'dev-user-001'); // Fallback for dev

    try {
      const ds = await beneficiaryApi.uploadDataset(formData);
      setSelectedDataset(ds);
      const pre = await beneficiaryApi.getPreview(ds._id);
      setPreview(pre);
      setMapping(pre.suggestions || {});
      setSubView('mapping');
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const startProcessing = async () => {
    try {
      await beneficiaryApi.processDataset(selectedDataset._id, mapping, data._id);
      setSubView('processing');
      pollStatus();
    } catch (err) {
      setError('Processing failed to start');
    }
  };

  const pollStatus = () => {
    const interval = setInterval(async () => {
      try {
        const stats = await beneficiaryApi.getStatus(selectedDataset._id);
        setStatus(stats);
        if (stats.status === 'complete') {
          clearInterval(interval);
          if (stats.failedCount > 0 || (stats.totalRows - stats.geocodedCount) > 0) {
            const clus = await beneficiaryApi.getClusters(selectedDataset._id);
            setClusters(clus);
            setSubView('resolution');
          } else {
            setSubView('summary');
          }
        }
      } catch (err) {
        clearInterval(interval);
      }
    }, 2000);
  };

  const handleResolve = async (clusterId, action, zoneId) => {
    const cluster = clusters.find(c => c.id === clusterId);
    const ids = cluster.records.map(r => r._id);
    
    try {
      const res = await beneficiaryApi.resolve(selectedDataset._id, action, ids, zoneId, data._id);
      setStatus(res.summary);
      const updatedClusters = clusters.filter(c => c.id !== clusterId);
      setClusters(updatedClusters);
      if (updatedClusters.length === 0) setSubView('summary');
    } catch (err) {
      setError('Resolution failed');
    }
  };

  // --- SUBVIEWS ---

  const ResolutionView = () => (
    <div style={{ marginTop: '1.5rem' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ color: '#fff', margin: 0 }}>Geospatial Resolution</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
               {clusters.length} population clusters found outside mission boundaries.
            </p>
          </div>
          <button 
             onClick={() => setSubView('summary')}
             style={{ padding: '0.6rem 1.25rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer' }}
          >
             Skip to Summary
          </button>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {clusters.map(cluster => (
            <motion.div 
              key={cluster.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}
            >
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>Out of Zone</div>
                    <h4 style={{ color: '#fff', margin: 0 }}>Cluster ({cluster.count} Beneficiaries)</h4>
                  </div>
                  <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700 }}>
                     +{cluster.avgOvershoot.toFixed(1)} km
                  </div>
               </div>

               <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                  Located near nearest zone: <strong>{data.regions[cluster.nearestZoneId]?.name || `Area ${parseInt(cluster.nearestZoneId) + 1}`}</strong>
               </p>

               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button 
                    onClick={() => handleResolve(cluster.id, 'expand_zone', cluster.nearestZoneId)}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Expand Zone Radius
                  </button>
                  <button 
                    onClick={() => handleResolve(cluster.id, 'reassign_zone', cluster.nearestZoneId)}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Reassign (Keep Radius)
                  </button>
                  <button 
                    onClick={() => handleResolve(cluster.id, 'exclude')}
                    style={{ width: '100%', padding: '0.75rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Exclude Records
                  </button>
               </div>
            </motion.div>
          ))}
       </div>
    </div>
  );

  const SourceSelector = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
      {/* UPLOAD NEW */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        style={{ 
          padding: '2rem', background: 'rgba(255,255,255,0.02)', 
          border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
          cursor: 'pointer', textAlign: 'center'
        }}
        onClick={() => document.getElementById('bene-upload').click()}
      >
        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Upload size={30} color="var(--primary)" />
        </div>
        <h4 style={{ color: '#fff', margin: 0 }}>Upload New Dataset</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>CSV or Excel files up to 10MB</p>
        <input id="bene-upload" type="file" hidden onChange={handleFileUpload} accept=".csv,.xlsx,.xls" />
      </motion.div>

      {/* SELECT EXISTING */}
      <div style={{ 
        padding: '1.5rem', background: 'rgba(255,255,255,0.02)', 
        border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px',
        maxHeight: '400px', overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Database size={18} color="var(--primary)" />
          <h4 style={{ color: '#fff', margin: 0 }}>Existing Library</h4>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {datasets.map(ds => (
            <div 
              key={ds._id}
              onClick={() => {
                setSelectedDataset(ds);
                // Trigger preview for existing
                beneficiaryApi.getPreview(ds._id).then(pre => {
                  setPreview(pre);
                  setMapping(ds.columnMapping || pre.suggestions || {});
                  setSubView('mapping');
                });
              }}
              style={{ 
                padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}
            >
              <div>
                <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{ds.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{ds.sourceFile?.rowCount || '---'} records</div>
              </div>
              <ChevronRight size={14} color="var(--text-dim)" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const ColumnMapper = () => (
    <div style={{ marginTop: '1.5rem' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ color: '#fff', margin: 0 }}>Column Architecture</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Map your dataset fields to tactical beneficiary attributes.</p>
          </div>
          <button 
            onClick={startProcessing}
            style={{ padding: '0.75rem 1.5rem', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
          >
            Initiate Geocoding Pipeline
          </button>
       </div>

       <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
          {/* PREVIEW TABLE */}
          <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
             <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', color: '#fff' }}>
                <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                   <tr>
                      {preview?.headers.map(h => <th key={h} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{h}</th>)}
                   </tr>
                </thead>
                <tbody>
                   {preview?.preview.map((row, i) => (
                     <tr key={i}>
                        {preview.headers.map(h => <td key={h} style={{ padding: '0.75rem', opacity: 0.7 }}>{row[h]}</td>)}
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {/* MAPPING CONTROLS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             {['name', 'phone', 'address', 'needCategory', 'severity'].map(field => (
               <div key={field} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    {field.replace(/([A-Z])/g, ' $1')}
                  </label>
                  <select 
                    value={mapping[field] || ''}
                    onChange={(e) => setMapping({...mapping, [field]: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px' }}
                  >
                    <option value="">Select Column...</option>
                    {preview?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
               </div>
             ))}
          </div>
       </div>
    </div>
  );

  const ProcessingView = () => (
    <div style={{ textAlign: 'center', padding: '4rem 0' }}>
       <Loader2 size={48} color="var(--primary)" className="animate-spin" style={{ margin: '0 auto 1.5rem' }} />
       <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>Tactical Geocoding in Progress</h3>
       <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
          Translating raw locations into high-precision GPS coordinates and resolving mission zone intersections.
       </p>
       
       <div style={{ marginTop: '3rem', width: '100%', maxWidth: '500px', margin: '3rem auto 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
             <span>Processed: {status?.geocodedCount || 0} / {status?.totalRows || '---'}</span>
             <span>{Math.round(((status?.geocodedCount || 0) / (status?.totalRows || 1)) * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${((status?.geocodedCount || 0) / (status?.totalRows || 1)) * 100}%` }}
               style={{ height: '100%', background: 'var(--primary)' }}
             />
          </div>
          {status?.failedCount > 0 && (
            <div style={{ marginTop: '1rem', color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
               <AlertCircle size={14} /> {status.failedCount} records failed to geocode
            </div>
          )}
       </div>
    </div>
  );

  return (
    <div style={{ minHeight: '500px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(79, 70, 229, 0.1)', borderRadius: '8px' }}>
          <Sparkles size={20} color="var(--primary)" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>Impact Scope Intelligence</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: 0 }}>Phase 3: Population Ingestion & Proximity Resolution</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {subView === 'source' && (
          <motion.div key="source" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <SourceSelector />
          </motion.div>
        )}
        {subView === 'mapping' && (
          <motion.div key="mapping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <ColumnMapper />
          </motion.div>
        )}
        {subView === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ProcessingView />
          </motion.div>
        )}
        {subView === 'resolution' && (
          <motion.div key="resolution" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
            <ResolutionView />
          </motion.div>
        )}
        {subView === 'summary' && (
          <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
               <CheckCircle2 size={48} color="var(--success)" style={{ margin: '0 auto 1.5rem' }} />
               <h3 style={{ color: '#fff' }}>Geocoding Complete</h3>
               <p style={{ color: 'var(--text-dim)' }}>Records have been resolved against project zones. Proceed to Temporal Planning.</p>
               <button 
                 onClick={() => update('beneficiaries', { 
                   beneficiarySummary: { 
                     totalCount: status.geocodedCount,
                     outOfZoneCount: status.failedCount + (status.totalRows - status.geocodedCount),
                     lastUpdated: new Date()
                   } 
                 })}
                 style={{ marginTop: '2rem', padding: '0.75rem 2rem', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
               >
                 Confirm & Continue
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isUploading && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
           <Loader2 size={32} color="var(--primary)" className="animate-spin" />
        </div>
      )}
    </div>
  );
};

export default Step3Beneficiaries;
