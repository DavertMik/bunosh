import React from 'react';
import { Play, Loader, FileText, Terminal } from 'lucide-react';

export const CommandInput = ({
  selectedCommand,
  commandInput,
  setCommandInput,
  executing,
  executeCommand,
  terminalOutput,
  isMobile
}) => {
  const neoBrutalButton = "px-4 py-2 font-medium border-2 border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";

  const clearTerminal = () => {
    setTerminalOutput([
      { type: 'system', text: '🍲 Terminal cleared', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  return (
    <div style={{
      backgroundColor: '#141414',
      borderRight: isMobile ? 'none' : '4px solid #2a2a2a',
      borderBottom: isMobile ? '4px solid #2a2a2a' : 'none',
      width: isMobile ? '100%' : '400px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1.5rem',
        borderBottom: '3px solid #2a2a2a'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#FFB400',
          marginBottom: '1rem',
          letterSpacing: '0.05em'
        }}>
          COMMAND INPUT
        </div>

        {selectedCommand && (
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '3px solid #2a2a2a',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{
              fontSize: '1rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: '#FFB400',
              fontFamily: 'Courier New, monospace'
            }}>
              {selectedCommand.name}
            </div>
            <div style={{ fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.8 }}>
              {selectedCommand.description}
            </div>
            {selectedCommand.params && selectedCommand.params.length > 0 && (
              <>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  marginBottom: '0.5rem',
                  color: '#7fc4c0'
                }}>
                  PARAMETERS:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedCommand.params.map((param, idx) => (
                    <span
                      key={idx}
                      style={{
                        backgroundColor: '#2a2a2a',
                        border: '2px solid #3a3a3a',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontFamily: 'Courier New, monospace',
                        color: '#9fc47a'
                      }}
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#FFB400',
            fontWeight: '700',
            fontSize: '1rem'
          }}>
            $
          </div>
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
            placeholder="bunosh [command]"
            style={{
              width: '100%',
              padding: '0.875rem 0.875rem 0.875rem 2rem',
              backgroundColor: '#1a1a1a',
              border: '3px solid #FFB400',
              color: '#e0e0e0',
              fontSize: '1rem',
              fontFamily: 'Courier New, monospace',
              outline: 'none',
              boxShadow: '4px 4px 0px 0px rgba(255,180,0,0.3)'
            }}
          />
        </div>

        <button
          onClick={executeCommand}
          disabled={executing || !commandInput.trim()}
          className={neoBrutalButton}
          style={{
            width: '100%',
            marginTop: '1rem',
            backgroundColor: executing ? '#3a3a3a' : '#FFB400',
            color: '#000',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '1rem',
            opacity: executing || !commandInput.trim() ? 0.5 : 1,
            cursor: executing || !commandInput.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'Courier New, monospace',
            borderColor: '#1a1a1a'
          }}
        >
          {executing ? (
            <>
              <Loader size={18} className="animate-spin" />
              EXECUTING...
            </>
          ) : (
            <>
              <Play size={18} strokeWidth={3} />
              EXECUTE
            </>
          )}
        </button>
      </div>

      <div style={{
        padding: '1.5rem'
      }}>
        <div style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          color: '#FFB400',
          marginBottom: '1rem',
          letterSpacing: '0.05em'
        }}>
          QUICK ACTIONS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            className={neoBrutalButton}
            style={{
              backgroundColor: '#2a2a2a',
              color: '#7fc4c0',
              fontSize: '0.875rem',
              justifyContent: 'flex-start',
              borderColor: '#3a3a3a'
            }}
          >
            <FileText size={16} />
            View Bunoshfile
          </button>
          <button
            className={neoBrutalButton}
            style={{
              backgroundColor: '#2a2a2a',
              color: '#e8847a',
              fontSize: '0.875rem',
              justifyContent: 'flex-start',
              borderColor: '#3a3a3a'
            }}
            onClick={clearTerminal}
          >
            <Terminal size={16} />
            Clear Terminal
          </button>
        </div>
      </div>
    </div>
  );
};