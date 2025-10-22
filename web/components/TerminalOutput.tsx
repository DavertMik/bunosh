import React from 'react';
import { Terminal, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const TerminalOutput = ({ terminalOutput }) => {
  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '1rem 1.5rem',
        backgroundColor: '#141414',
        borderBottom: '3px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <Terminal size={18} color="#FFB400" strokeWidth={2.5} />
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#FFB400',
          letterSpacing: '0.05em'
        }}>
          TERMINAL OUTPUT
        </div>
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#9fc47a',
            border: '2px solid #1a1a1a'
          }} />
          <span style={{ fontSize: '0.75rem', color: '#9fc47a' }}>READY</span>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '1.5rem',
        fontFamily: 'Courier New, monospace',
        fontSize: '0.875rem',
        lineHeight: 1.6
      }}>
        {terminalOutput.map((line, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: '0.5rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start'
            }}
          >
            <span style={{
              color: '#666',
              fontSize: '0.75rem',
              minWidth: '60px',
              flexShrink: 0
            }}>
              {line.timestamp}
            </span>
            <div style={{
              color: line.type === 'command' ? '#FFB400' :
                     line.type === 'success' ? '#9fc47a' :
                     line.type === 'error' ? '#e8847a' :
                     line.type === 'info' ? '#7fc4c0' :
                     line.type === 'warning' ? '#f2d974' :
                     '#e0e0e0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {line.type === 'success' && <CheckCircle size={14} />}
              {line.type === 'error' && <XCircle size={14} />}
              {line.type === 'warning' && <AlertCircle size={14} />}
              <span>{line.text}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};