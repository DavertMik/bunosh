import React from 'react';
import { PanelLeft, ChevronRight, ChevronDown, Menu, X } from 'lucide-react';

export const CommandList = ({
  commands,
  selectedCommand,
  onSelectCommand,
  setCommandInput,
  isMobile,
  leftCollapsed,
  setLeftCollapsed,
  mobileMenuOpen,
  setMobileMenuOpen
}) => {
  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const [expandedGroups, setExpandedGroups] = React.useState({
    'Core': true,
    'Development': true,
    'API': true,
    'Database': true,
    'Git': true
  });

  const handleCommandClick = (cmd) => {
    onSelectCommand(cmd);
    setCommandInput(cmd.name);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Overlay Menu */}
      {isMobile && mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '80px',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1a1a1a',
          zIndex: 1000,
          overflowY: 'auto',
          borderTop: '4px solid #2a2a2a'
        }}>
          <div style={{ padding: '1rem' }}>
            {Object.entries(commands).map(([group, cmds]) => (
              <div key={group} style={{ marginBottom: '1rem' }}>
                <button
                  onClick={() => toggleGroup(group)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: '#2a2a2a',
                    border: '3px solid #3a3a3a',
                    color: '#FFB400',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}
                >
                  {expandedGroups[group] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {group.toUpperCase()}
                </button>
                {expandedGroups[group] && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {cmds.map((cmd) => (
                      <button
                        key={cmd.name}
                        onClick={() => handleCommandClick(cmd)}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: selectedCommand?.name === cmd.name ? '#FFB400' : '#2a2a2a',
                          color: selectedCommand?.name === cmd.name ? '#000' : '#e0e0e0',
                          border: '3px solid #3a3a3a',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: selectedCommand?.name === cmd.name ? '700' : '500',
                          fontSize: '0.875rem'
                        }}
                      >
                        <div style={{ fontFamily: 'Courier New, monospace', marginBottom: '0.25rem' }}>
                          {cmd.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                          {cmd.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left Sidebar - Commands List */}
      {!isMobile && (
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRight: '4px solid #2a2a2a',
          width: leftCollapsed ? '80px' : '280px',
          transition: 'width 0.3s ease',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            style={{
              padding: '1rem',
              backgroundColor: '#2a2a2a',
              border: 'none',
              borderBottom: '3px solid #3a3a3a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFB400'
            }}
          >
            <PanelLeft size={20} strokeWidth={2.5} style={{
              transform: leftCollapsed ? 'scaleX(-1)' : 'none',
              transition: 'transform 0.3s ease'
            }} />
          </button>

          <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
            {!leftCollapsed && (
              <>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: '#FFB400',
                  marginBottom: '1rem',
                  letterSpacing: '0.05em'
                }}>
                  COMMANDS
                </div>
                {Object.entries(commands).map(([group, cmds]) => (
                  <div key={group} style={{ marginBottom: '1.5rem' }}>
                    <button
                      onClick={() => toggleGroup(group)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#FFB400',
                        fontWeight: '700',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        marginBottom: '0.5rem',
                        textAlign: 'left'
                      }}
                    >
                      {expandedGroups[group] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {group.toUpperCase()}
                    </button>
                    {expandedGroups[group] && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {cmds.map((cmd) => (
                          <button
                            key={cmd.name}
                            onClick={() => handleCommandClick(cmd)}
                            style={{
                              padding: '0.75rem',
                              backgroundColor: selectedCommand?.name === cmd.name ? '#FFB400' : '#2a2a2a',
                              color: selectedCommand?.name === cmd.name ? '#000' : '#e0e0e0',
                              border: selectedCommand?.name === cmd.name ? '3px solid #FFB400' : '2px solid #3a3a3a',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontWeight: selectedCommand?.name === cmd.name ? '700' : '400',
                              fontSize: '0.875rem',
                              transition: 'all 0.15s',
                              boxShadow: selectedCommand?.name === cmd.name ? '3px 3px 0px 0px rgba(255,180,0,0.5)' : 'none'
                            }}
                          >
                            <div style={{ fontFamily: 'Courier New, monospace', marginBottom: '0.25rem' }}>
                              {cmd.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                              {cmd.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            {leftCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                {Object.values(commands).flat().map((cmd, idx) => (
                  <button
                    key={idx}
                    title={cmd.name}
                    onClick={() => handleCommandClick(cmd)}
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: selectedCommand?.name === cmd.name ? '#FFB400' : '#2a2a2a',
                      color: selectedCommand?.name === cmd.name ? '#000' : '#FFB400',
                      border: '2px solid #3a3a3a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      fontWeight: '700'
                    }}
                  >
                    {cmd.name.charAt(0).toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};