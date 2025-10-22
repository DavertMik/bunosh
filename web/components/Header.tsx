import React from 'react';
import { Settings } from 'lucide-react';

export const Header = () => {
  const neoBrutalButton = "px-4 py-2 font-medium border-2 border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";

  return (
    <div style={{
      backgroundColor: '#FFB400',
      borderBottom: '4px solid #1a1a1a',
      padding: '1rem 1.5rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '36px',
          height: '36px',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '3px solid #000',
          fontSize: '1.5rem'
        }}>
          🍲
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', lineHeight: 1, color: '#000' }}>BUNOSH</div>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1a1a1a' }}>MODERN TASK RUNNER</div>
        </div>
        <button
          className={neoBrutalButton}
          style={{
            backgroundColor: '#1a1a1a',
            color: '#FFB400',
            fontSize: '0.875rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Settings size={16} strokeWidth={2.5} />
          CONFIG
        </button>
      </div>
    </div>
  );
};