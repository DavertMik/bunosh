import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { CommandList } from './components/CommandList';
import { CommandInput } from './components/CommandInput';
import { TerminalOutput } from './components/TerminalOutput';
import { AskModal } from './components/AskModal';
import { useBunoshAPI } from './hooks/useBunoshAPI';

export const App = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    commands,
    selectedCommand,
    setSelectedCommand,
    commandInput,
    setCommandInput,
    executing,
    terminalOutput,
    executeCommand,
    askPrompt,
    askResponse,
    setAskResponse,
    askId,
    askOptions,
    handleAskSubmit
  } = useBunoshAPI();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{
      fontFamily: 'Courier New, monospace',
      backgroundColor: '#0a0a0a',
      minHeight: '100vh',
      color: '#e0e0e0'
    }}>
      <Header />

      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: 'calc(100vh - 80px)',
        position: 'relative'
      }}>
        <CommandList
          commands={commands}
          selectedCommand={selectedCommand}
          onSelectCommand={setSelectedCommand}
          setCommandInput={setCommandInput}
          isMobile={isMobile}
          leftCollapsed={leftCollapsed}
          setLeftCollapsed={setLeftCollapsed}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        <CommandInput
          selectedCommand={selectedCommand}
          commandInput={commandInput}
          setCommandInput={setCommandInput}
          executing={executing}
          executeCommand={executeCommand}
          terminalOutput={terminalOutput}
          isMobile={isMobile}
        />

        <TerminalOutput terminalOutput={terminalOutput} />
      </div>

      {askPrompt && (
        <AskModal
          prompt={askPrompt}
          response={askResponse}
          setResponse={setAskResponse}
          onSubmit={handleAskSubmit}
          askOptions={askOptions}
        />
      )}

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