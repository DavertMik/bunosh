import { useState, useEffect, useRef } from 'react';

export const useBunoshAPI = () => {
  const [commands, setCommands] = useState({});
  const [selectedCommand, setSelectedCommand] = useState(null);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'system', text: '🍲 Bunosh Task Runner v1.0.0', timestamp: '10:30:00' },
    { type: 'system', text: 'Modern CLI task runner powered by JS and Bun', timestamp: '10:30:00' },
    { type: 'system', text: 'Ready to execute commands...', timestamp: '10:30:01' }
  ]);
  const [askPrompt, setAskPrompt] = useState(null);
  const [askResponse, setAskResponse] = useState('');
  const [askId, setAskId] = useState(null);
  const [askOptions, setAskOptions] = useState({});

  const eventSourceRef = useRef(null);

  // Load commands on mount
  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      const response = await fetch('/api/commands');
      if (response.ok) {
        const data = await response.json();
        setCommands(data.commands);
      }
    } catch (error) {
      console.error('Failed to load commands:', error);
    }
  };

  const executeCommand = async () => {
    if (!commandInput.trim()) return;

    setExecuting(true);
    const timestamp = new Date().toLocaleTimeString();

    setTerminalOutput(prev => [...prev,
      { type: 'command', text: `$ bunosh ${commandInput}`, timestamp },
      { type: 'info', text: '⚡ Executing command...', timestamp }
    ]);

    try {
      // Parse command and arguments
      const parts = commandInput.split(' ');
      const command = parts[0];
      const args = parts.slice(1);

      // Start SSE for command output
      const eventSource = new EventSource(`/api/execute?command=${encodeURIComponent(command)}&args=${encodeURIComponent(args.join(' '))}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const newTimestamp = new Date().toLocaleTimeString();

        if (data.type === 'output') {
          setTerminalOutput(prev => [...prev, {
            type: 'output',
            text: data.text,
            timestamp: newTimestamp
          }]);
        } else if (data.type === 'error') {
          setTerminalOutput(prev => [...prev, {
            type: 'error',
            text: data.text,
            timestamp: newTimestamp
          }]);
        } else if (data.type === 'success') {
          setTerminalOutput(prev => [...prev, {
            type: 'success',
            text: data.text,
            timestamp: newTimestamp
          }]);
        } else if (data.type === 'ask') {
          // Pause execution and show ask modal
          setAskPrompt(data.question);
          setAskId(data.id);
          setAskOptions({
            defaultValue: data.defaultValue,
            options: data.options
          });
          // Don't close EventSource - just pause processing
          return;
        } else if (data.type === 'complete') {
          setTerminalOutput(prev => [...prev, {
            type: 'success',
            text: '✅ Task completed successfully',
            timestamp: newTimestamp
          }]);
          eventSource.close();
          setExecuting(false);
        }
      };

      eventSource.onerror = () => {
        setTerminalOutput(prev => [...prev, {
          type: 'error',
          text: '❌ Command execution failed',
          timestamp: new Date().toLocaleTimeString()
        }]);
        eventSource.close();
        setExecuting(false);
      };

    } catch (error) {
      setTerminalOutput(prev => [...prev, {
        type: 'error',
        text: `❌ Error: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
      setExecuting(false);
    }
  };

  const handleAskSubmit = async () => {
    if (!askId || !askResponse.trim()) return;

    try {
      // Send response to ask endpoint
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          askId: askId,
          response: askResponse
        })
      });

      if (response.ok) {
        // Clear ask modal
        setAskPrompt(null);
        setAskId(null);
        setAskResponse('');
        setAskOptions({});

        // Add user response to terminal
        const timestamp = new Date().toLocaleTimeString();
        setTerminalOutput(prev => [...prev, {
          type: 'info',
          text: `📝 User input: ${askResponse}`,
          timestamp
        }]);
      }
    } catch (error) {
      console.error('Failed to submit ask response:', error);
    }
  };

  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
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
  };
};