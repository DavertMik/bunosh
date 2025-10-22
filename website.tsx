import React, { useState } from 'react';
import { Terminal, Play, Loader, CheckCircle, XCircle, AlertCircle, ChevronRight, ChevronDown, Command, Settings, FileText, PanelLeft, Menu, X } from 'lucide-react';

const BunoshUI = () => {
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'system', text: '🍲 Bunosh Task Runner v1.0.0', timestamp: '10:30:00' },
    { type: 'system', text: 'Modern CLI task runner powered by JS and Bun', timestamp: '10:30:00' },
    { type: 'system', text: 'Ready to execute commands...', timestamp: '10:30:01' }
  ]);
  const [expandedGroups, setExpandedGroups] = useState({
    'Core': true,
    'Development': true,
    'API': true,
    'Database': true,
    'Git': true
  });
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const commands = {
    'Core': [
      { name: 'build', description: 'Build the project for production', params: ['env=production'] },
      { name: 'test', description: 'Run all tests', params: [] },
      { name: 'deploy', description: 'Deploy to environment', params: ['env=staging', '--force', '--verbose'] }
    ],
    'Development': [
      { name: 'dev:start', description: 'Start development server', params: [] },
      { name: 'dev:debug', description: 'Start debug mode', params: [] },
      { name: 'dev:watch', description: 'Watch for file changes', params: [] }
    ],
    'API': [
      { name: 'api:deploy', description: 'Deploy API services', params: ['env'] },
      { name: 'api:test', description: 'Run API tests', params: [] },
      { name: 'api:health-check', description: 'Check service health', params: ['url'] }
    ],
    'Database': [
      { name: 'db:migrate', description: 'Run database migrations', params: [] },
      { name: 'db:seed', description: 'Seed database with data', params: [] },
      { name: 'db:backup', description: 'Create database backup', params: [] }
    ],
    'Git': [
      { name: 'git:feature', description: 'Create a new feature branch', params: ['name', 'base=main', '--push'] },
      { name: 'git:commit', description: 'AI-generated commit message', params: [] },
      { name: 'git:cleanup', description: 'Clean up merged branches', params: [] }
    ]
  };

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const executeCommand = async () => {
    if (!commandInput.trim()) return;
    
    setExecuting(true);
    const timestamp = new Date().toLocaleTimeString();
    
    setTerminalOutput(prev => [...prev, 
      { type: 'command', text: `$ bunosh ${commandInput}`, timestamp },
      { type: 'info', text: '⚡ Executing command...', timestamp }
    ]);

    // Simulate command execution
    setTimeout(() => {
      const newTimestamp = new Date().toLocaleTimeString();
      setTerminalOutput(prev => [...prev,
        { type: 'success', text: '✅ Task completed successfully', timestamp: newTimestamp },
        { type: 'output', text: 'Build finished in 2.3s', timestamp: newTimestamp }
      ]);
      setExecuting(false);
    }, 1500);
  };

  const handleCommandClick = (cmd) => {
    setSelectedCommand(cmd);
    setCommandInput(cmd.name);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const neoBrutalButton = "px-4 py-2 font-medium border-2 border-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all";

  return (
    <div style={{ 
      fontFamily: 'Courier New, monospace',
      backgroundColor: '#0a0a0a',
      minHeight: '100vh',
      color: '#e0e0e0'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#FFB400',
        borderBottom: '4px solid #1a1a1a',
        padding: '1rem 1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {mobileMenuOpen ? <X size={24} color="#000" /> : <Menu size={24} color="#000" />}
            </button>
          )}
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
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Settings size={16} strokeWidth={2.5} />
            CONFIG
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        height: 'calc(100vh - 80px)',
        position: 'relative'
      }}>
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

        {/* Middle Section - Command Input */}
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
                {selectedCommand.params.length > 0 && (
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
                onClick={() => setTerminalOutput([
                  { type: 'system', text: '🍲 Terminal cleared', timestamp: new Date().toLocaleTimeString() }
                ])}
              >
                <Terminal size={16} />
                Clear Terminal
              </button>
            </div>
          </div>
        </div>

        {/* Right Section - Terminal Output */}
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
      </div>

      {/* Attribution Badge */}
      <a
        href="https://popmelt.com?utm_source=mcp&utm_medium=artifact&utm_campaign=made_with&utm_source=Claude Chat"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          backgroundColor: '#FFB400',
          border: '2px solid #000',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          fontSize: '0.75rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          boxShadow: '2px 2px 0px 0px rgba(0,0,0,1)',
          textDecoration: 'none',
          color: '#000',
          zIndex: 1000
        }}
      >
        Made with
        <svg width="15" height="16" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.6068 15.5C1.10915 15.5 0.800113 14.8672 0.596075 14.15C0.466251 13.6937 0.382714 13.4759 0.302057 13.0088C0.291879 12.9499 0.277255 12.8669 0.264373 12.794C0.0914666 12.0574 0 11.2894 0 10.5C0 4.97715 4.47715 0.5 10 0.5C15.5228 0.5 20 4.97715 20 10.5C20 11.2271 19.9474 11.8919 19.8 12.575L19.7662 12.6939C19.7007 13.0054 19.5949 13.5087 19.4509 14.0177L19.4502 14.0202C19.4142 14.1474 19.3757 14.275 19.335 14.4C19.1011 15.1172 18.7896 15.75 18.4068 15.75C18.1345 15.75 17.9998 15.473 17.8599 15.1852C17.7086 14.8739 17.5511 14.55 17.2068 14.55C16.5441 14.55 16.0068 15.0872 16.0068 15.75L16.0068 16.3974C16.0068 16.8397 15.8052 17.2596 15.4338 17.5C14.6045 18.0368 13.6068 17.3688 13.6068 16.381L13.6068 15.75C13.6068 15.0872 13.0695 14.55 12.4068 14.55C11.7441 14.55 11.2068 15.0872 11.2068 15.75C11.2068 16.2607 11.2174 16.7752 11.2281 17.291L11.2281 17.291L11.2281 17.2915C11.2415 17.9374 11.2549 18.5853 11.2474 19.2297C11.2394 19.9253 10.7025 20.5 10.0068 20.5C9.31113 20.5 8.77418 19.9253 8.76615 19.2297C8.75871 18.5851 8.77212 17.9371 8.78548 17.291C8.79615 16.7753 8.8068 17.2607 8.8068 16.75C8.8068 16.0872 8.26954 15.55 7.6068 15.55C6.94406 15.55 6.4068 16.0872 6.4068 16.75V17.7817C6.4068 18.7695 5.40908 19.4375 4.57981 18.9007C4.20845 18.6603 4.0068 18.2404 4.0068 17.7981V15.75C4.0068 15.0872 3.46954 14.55 2.8068 14.55C2.49101 14.55 2.38536 14.5724 2.27473 14.8577C2.15318 15.1711 2.02563 15.5 1.6068 15.5Z" fill="black"/>
        </svg>
      </a>
    </div>
  );
};

export default BunoshUI;