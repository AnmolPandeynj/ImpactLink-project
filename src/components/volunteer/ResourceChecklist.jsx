import React, { useState } from 'react';
import { Check, Package } from 'lucide-react';

export default function ResourceChecklist({ assignment }) {
  // Mock generic checklist items based on severity or type
  const [items, setItems] = useState([
    { id: 1, label: 'Standard Field Kit', checked: false },
    { id: 2, label: 'Identification Badge visible', checked: false },
    { id: 3, label: 'Transport fueled & ready', checked: false },
    { id: 4, label: 'Comms unit charged', checked: false }
  ]);

  const toggleItem = (id) => {
    setItems(items.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const allChecked = items.every(i => i.checked);

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '1rem' }}>
      <h3 style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Package size={14} /> Deployment Checklist
      </h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map(item => (
          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', background: item.checked ? 'rgba(52, 211, 153, 0.05)' : 'transparent', borderRadius: '8px', transition: 'background 0.2s' }}>
            <div style={{ 
              width: '20px', height: '20px', borderRadius: '6px', 
              border: `2px solid ${item.checked ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
              background: item.checked ? '#10b981' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {item.checked && <Check size={14} color="#000" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '0.9rem', color: item.checked ? 'var(--text-muted)' : '#fff', textDecoration: item.checked ? 'line-through' : 'none' }}>
              {item.label}
            </span>
          </label>
        ))}
      </div>

      {allChecked && (
        <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(52, 211, 153, 0.1)', color: '#10b981', fontSize: '0.8rem', textAlign: 'center', borderRadius: '6px' }}>
          Checklist completed. Ready for deployment.
        </div>
      )}
    </div>
  );
}
