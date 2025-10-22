import { processCommands } from './program.js';
import Convert from 'ansi-to-html';

class BunoshWebServer {
  constructor(port = 3000) {
    this.port = port;
    this.server = null;
    this.commands = {};
    this.sources = {};
    this.activeConnections = new Map();
    this.askPrompts = new Map();
    this.ansiConverter = new Convert({
      fg: '#e0e0e0',
      bg: '#0a0a0a',
      newline: false,
      escapeXML: true,
      stream: false,
      colors: {
        0: '#000000',     // black
        1: '#ff5555',     // red
        2: '#50fa7b',     // green
        3: '#f1fa8c',     // yellow
        4: '#6272a4',     // blue
        5: '#ff79c6',     // magenta
        6: '#8be9fd',     // cyan
        7: '#f8f8f2',     // white
        8: '#555555',     // bright black
        9: '#ff5555',     // bright red
        10: '#50fa7b',    // bright green
        11: '#f1fa8c',    // bright yellow
        12: '#6272a4',    // bright blue
        13: '#ff79c6',    // bright magenta
        14: '#8be9fd',    // bright cyan
        15: '#f8f8f2'     // bright white
      }
    });
  }

  setCommands(commands, sources) {
    this.commands = commands;
    this.sources = sources;

    // Set up global ask function for web server mode
    this.setupAskFunction();
  }

  setupAskFunction() {
    // Store the original ask function
    const originalAsk = global.bunosh?.ask;

    // Override global ask function to capture prompts in web server mode
    global.bunosh.ask = async (question, defaultValueOrOptions = {}, options = {}) => {
      // Return a promise that will be resolved when the user responds via the web interface
      return new Promise((resolve, reject) => {
        // Store the resolve function for this specific ask call
        const askId = Math.random().toString(36).substr(2, 9);
        this.askPrompts.set(askId, { resolve, reject, question, defaultValue: defaultValueOrOptions, options });

        // Send the ask prompt to the frontend through a special mechanism
        // We need to capture this in the command execution context
        if (this.currentConnectionController) {
          const promptText = this.formatPrompt(question, defaultValueOrOptions, options);
          this.currentConnectionController.enqueue(`data: ${JSON.stringify({
            type: 'ask',
            id: askId,
            prompt: promptText,
            question: question,
            defaultValue: defaultValueOrOptions,
            options: options
          })}\n\n`);
        } else {
          // Fallback to original ask if no active connection
          if (originalAsk) {
            originalAsk(question, defaultValueOrOptions, options).then(resolve).catch(reject);
          } else {
            resolve(defaultValueOrOptions || '');
          }
        }
      });
    };
  }

  formatPrompt(question, defaultValueOrOptions, options) {
    // Format the prompt similarly to how inquirer does it
    if (typeof defaultValueOrOptions !== 'object' || defaultValueOrOptions === null) {
      // Simple default value case
      const defaultValue = defaultValueOrOptions;
      if (typeof defaultValue === 'boolean') {
        return `${question} (${defaultValue ? 'Y/n' : 'y/N'})`;
      }
      if (defaultValue) {
        return `${question} (${defaultValue})`;
      }
      return question;
    }

    // Complex options case
    if (defaultValueOrOptions.choices) {
      return question;
    }

    if (defaultValueOrOptions.default !== undefined) {
      return `${question} (${defaultValueOrOptions.default})`;
    }

    return question;
  }

  start() {
    this.server = Bun.serve({
      port: this.port,
      fetch: this.handleRequest.bind(this),
      websocket: {
        message: (ws, message) => this.handleWebSocketMessage(ws, message),
        open: (ws) => this.handleWebSocketOpen(ws),
        close: (ws) => this.handleWebSocketClose(ws),
        error: (ws, error) => this.handleWebSocketError(ws, error)
      },
      error(error) {
        console.error('Server error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    });

    console.log(`🌐 Bunosh Web Server started at http://localhost:${this.port}`);
    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.stop();
      console.log('🛑 Web server stopped');
    }
  }

  async handleRequest(request) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    // Handle API endpoints
    if (pathname.startsWith('/api/')) {
      return this.handleAPIRequest(request, pathname, searchParams);
    }

    // Serve static files and React app
    if (pathname === '/' || pathname.startsWith('/static/')) {
      return this.serveStaticFile(pathname);
    }

    return new Response('Not Found', { status: 404 });
  }

  async handleAPIRequest(request, pathname, searchParams) {
    try {
      switch (pathname) {
        case '/api/commands':
          return this.handleCommandsList();

        case '/api/execute':
          return this.handleCommandExecute(searchParams);

        case '/api/execute/resume':
          return this.handleCommandResume(request);

        case '/api/ask':
          return this.handleAskResponse(request);

        default:
          return new Response('API endpoint not found', { status: 404 });
      }
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  handleCommandsList() {
    const parsedCommands = processCommands(this.commands, this.sources);

    // Group commands by namespace for the UI
    const commandsByNamespace = {
      'Core': [],
      'Development': [],
      'API': [],
      'Database': [],
      'Git': []
    };

    parsedCommands.forEach(cmd => {
      const category = this.categorizeCommand(cmd.name);
      const params = this.extractCommandParams(cmd);

      commandsByNamespace[category].push({
        name: cmd.cliName,
        originalName: cmd.name, // Store the original function name
        description: cmd.comment || 'No description available',
        params: params,
        fullName: cmd.fullName,
        namespace: cmd.namespace
      });
    });

    // Filter out empty categories
    Object.keys(commandsByNamespace).forEach(key => {
      if (commandsByNamespace[key].length === 0) {
        delete commandsByNamespace[key];
      }
    });

    return new Response(JSON.stringify({ commands: commandsByNamespace }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  handleCommandExecute(searchParams) {
    const command = searchParams.get('command');
    const argsString = searchParams.get('args') || '';

    if (!command) {
      return new Response(JSON.stringify({ error: 'Command is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse arguments - filter out empty strings
    const args = argsString ? argsString.split(' ').filter(arg => arg.length > 0) : [];

    // Capture self reference for use in stream
    const self = this;

    // Create a new stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        controller.enqueue(`data: ${JSON.stringify({ type: 'info', text: '🚀 Starting command execution...' })}\n\n`);

        // Execute command in background
        self.executeCommandWithStreaming(command, args, controller).catch(error => {
          console.error('Command execution failed:', error);
          controller.enqueue(`data: ${JSON.stringify({ type: 'error', text: `Command failed: ${error.message}` })}\n\n`);
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  async executeCommandWithStreaming(commandName, commandArgs, controller) {
    const connectionId = Math.random().toString(36).substr(2, 9);
    this.activeConnections.set(connectionId, controller);

    // Store the current controller for ask function access
    this.currentConnectionController = controller;

    try {
      // Redirect console.log and console.error to capture output
      const originalLog = console.log;
      const originalError = console.error;

      console.log = (...args) => {
        const message = args.join(' ');
        const htmlMessage = this.ansiConverter.toHtml(message);
        controller.enqueue(`data: ${JSON.stringify({ type: 'output', text: message, html: htmlMessage })}\n\n`);
        originalLog(...args);
      };

      console.error = (...args) => {
        const message = args.join(' ');
        const htmlMessage = this.ansiConverter.toHtml(message);
        controller.enqueue(`data: ${JSON.stringify({ type: 'error', text: message, html: htmlMessage })}\n\n`);
        originalError(...args);
      };

      // Find the command function by name (not CLI name)
      let commandFn = null;

      // First try exact match
      commandFn = this.commands[commandName];

      // If not found, try kebab-case to camelCase conversion
      if (!commandFn) {
        const camelCaseName = commandName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        commandFn = this.commands[camelCaseName];
      }

      // Try other variations
      if (!commandFn) {
        // Try converting kebab-case with namespace
        const parts = commandName.split(':');
        if (parts.length === 2) {
          const namespace = parts[0];
          const funcName = parts[1].replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          const namespacedName = `${namespace}${funcName.charAt(0).toUpperCase() + funcName.slice(1)}`;
          commandFn = this.commands[namespacedName];
        }
      }

      if (!commandFn) {
        throw new Error(`Command '${commandName}' not found. Available commands: ${Object.keys(this.commands).join(', ')}`);
      }

      // Execute the command with proper arguments
      controller.enqueue(`data: ${JSON.stringify({ type: 'info', text: `Executing ${commandName}...` })}\n\n`);

      const result = await commandFn(...commandArgs);

      // Restore original functions
      console.log = originalLog;
      console.error = originalError;

      // Send completion event
      controller.enqueue(`data: ${JSON.stringify({
        type: 'complete',
        text: 'Command completed successfully',
        result: result
      })}\n\n`);

    } catch (error) {
      // Restore original functions in case of error
      console.log = originalLog;
      console.error = originalError;

      // Send error event
      controller.enqueue(`data: ${JSON.stringify({
        type: 'error',
        text: `Command failed: ${error.message}`
      })}\n\n`);
    } finally {
      // Clean up
      this.activeConnections.delete(connectionId);
      this.currentConnectionController = null;
      controller.close();
    }
  }

  handleCommandResume(request) {
    const stream = new ReadableStream({
      start(controller) {
        // Resume command execution after ask response
        // This would typically wait for the ask response to be processed
        controller.enqueue(`data: ${JSON.stringify({ type: 'info', text: '🔄 Resuming command execution...' })}\n\n`);

        // The actual resume logic would be handled by the ask endpoint
        setTimeout(() => {
          controller.enqueue(`data: ${JSON.stringify({ type: 'complete', text: 'Command resumed successfully' })}\n\n`);
          controller.close();
        }, 100);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  async handleAskResponse(request) {
    try {
      const { askId, response } = await request.json();

      // Find the pending ask promise and resolve it using the askId
      const askData = this.askPrompts.get(askId);

      if (askData) {
        const { resolve, defaultValue, options } = askData;

        // Process the response based on the expected type
        let processedResponse = response;

        // Handle boolean responses
        if (typeof defaultValue === 'boolean') {
          processedResponse = response === 'true' || response === true;
        }
        // Handle array choices
        else if (Array.isArray(defaultValue) && defaultValue.includes(response)) {
          processedResponse = response;
        }
        // Handle default values for empty responses
        else if (!response || response.trim() === '') {
          processedResponse = defaultValue !== undefined ? defaultValue : response;
        }

        resolve(processedResponse);
        this.askPrompts.delete(askId);
      } else {
        console.warn(`No pending ask found for ID: ${askId}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  serveStaticFile(pathname) {
    if (pathname === '/') {
      // Serve the main HTML file with React app
      const html = this.generateHTML();
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // For now, return a simple 404 for static files
    // In a real implementation, you'd serve from a static directory
    return new Response('Static file not found', { status: 404 });
  }

  generateHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bunosh Task Runner</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Courier New', monospace;
            background-color: #0a0a0a;
            color: #e0e0e0;
            overflow: hidden;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        .neo-brutal-button {
            padding: 0.5rem 1rem;
            font-weight: 600;
            border: 2px solid #374151;
            box-shadow: 4px 4px 0px 0px rgba(0,0,0,1);
            transition: all 0.2s;
            background-color: #fbbf24;
            color: #000;
            font-family: 'Courier New', monospace;
        }
        .neo-brutal-button:hover {
            box-shadow: 2px 2px 0px 0px rgba(0,0,0,1);
            transform: translate(2px, 2px);
        }

        /* ANSI color styles */
        .ansi-bright-black-fg { color: #555555; }
        .ansi-bright-red-fg { color: #ff5555; }
        .ansi-bright-green-fg { color: #50fa7b; }
        .ansi-bright-yellow-fg { color: #f1fa8c; }
        .ansi-bright-blue-fg { color: #6272a4; }
        .ansi-bright-magenta-fg { color: #ff79c6; }
        .ansi-bright-cyan-fg { color: #8be9fd; }
        .ansi-bright-white-fg { color: #f8f8f2; }
        .ansi-black-fg { color: #000000; }
        .ansi-red-fg { color: #ff5555; }
        .ansi-green-fg { color: #50fa7b; }
        .ansi-yellow-fg { color: #f1fa8c; }
        .ansi-blue-fg { color: #6272a4; }
        .ansi-magenta-fg { color: #ff79c6; }
        .ansi-cyan-fg { color: #8be9fd; }
        .ansi-white-fg { color: #f8f8f2; }

        .ansi-bright-black-bg { background-color: #555555; }
        .ansi-bright-red-bg { background-color: #ff5555; }
        .ansi-bright-green-bg { background-color: #50fa7b; }
        .ansi-bright-yellow-bg { background-color: #f1fa8c; }
        .ansi-bright-blue-bg { background-color: #6272a4; }
        .ansi-bright-magenta-bg { background-color: #ff79c6; }
        .ansi-bright-cyan-bg { background-color: #8be9fd; }
        .ansi-bright-white-bg { background-color: #f8f8f2; }
        .ansi-black-bg { background-color: #000000; }
        .ansi-red-bg { background-color: #ff5555; }
        .ansi-green-bg { background-color: #50fa7b; }
        .ansi-yellow-bg { background-color: #f1fa8c; }
        .ansi-blue-bg { background-color: #6272a4; }
        .ansi-magenta-bg { background-color: #ff79c6; }
        .ansi-cyan-bg { background-color: #8be9fd; }
        .ansi-white-bg { background-color: #f8f8f2; }

        .ansi-bold { font-weight: bold; }
        .ansi-italic { font-style: italic; }
        .ansi-underline { text-decoration: underline; }
        .ansi-blink { animation: blink 1s infinite; }
        .ansi-inverse { color: #000; background-color: #f8f8f2; }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" data-type="module">
        const { useState, useEffect } = React;

        // Simplified App component
        const App = () => {
            const [commands, setCommands] = useState({});
            const [selectedCommand, setSelectedCommand] = useState(null);
            const [commandInput, setCommandInput] = useState('');
            const [executing, setExecuting] = useState(false);
            const [terminalOutput, setTerminalOutput] = useState([
                { type: 'system', text: '🍲 Bunosh Task Runner v1.0.0', timestamp: new Date().toLocaleTimeString() },
                { type: 'system', text: 'Modern CLI task runner powered by JS and Bun', timestamp: new Date().toLocaleTimeString() },
                { type: 'system', text: 'Ready to execute commands...', timestamp: new Date().toLocaleTimeString() }
            ]);

            useEffect(() => {
                loadCommands();
            }, []);

            const [askPrompt, setAskPrompt] = useState(null);
            const [askResponse, setAskResponse] = useState('');
            const [currentAskId, setCurrentAskId] = useState(null);
            const [askOptions, setAskOptions] = useState({});

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
                    { type: 'command', text: \`$ bunosh \${commandInput}\`, timestamp },
                    { type: 'info', text: '⚡ Executing command...', timestamp }
                ]);

                try {
                    const parts = commandInput.split(' ');
                    const commandCliName = parts[0];
                    const args = parts.slice(1).join(' ');

                    // Find the command in the loaded commands to get the original function name
                    let originalCommandName = commandCliName;
                    Object.values(commands).forEach(categoryCommands => {
                        const foundCommand = categoryCommands.find(cmd => cmd.name === commandCliName);
                        if (foundCommand && foundCommand.originalName) {
                            originalCommandName = foundCommand.originalName;
                        }
                    });

                    const eventSource = new EventSource(\`/api/execute?command=\${encodeURIComponent(originalCommandName)}&args=\${encodeURIComponent(args)}\`);

                    eventSource.onmessage = (event) => {
                        const data = JSON.parse(event.data);
                        const newTimestamp = new Date().toLocaleTimeString();

                        if (data.type === 'complete') {
                            setTerminalOutput(prev => [...prev, {
                                type: 'success',
                                text: '✅ Task completed successfully',
                                timestamp: newTimestamp
                            }]);
                            eventSource.close();
                            setExecuting(false);
                        } else if (data.type === 'error') {
                            setTerminalOutput(prev => [...prev, {
                                type: 'error',
                                text: data.text,
                                timestamp: newTimestamp
                            }]);
                            eventSource.close();
                            setExecuting(false);
                        } else if (data.type === 'ask') {
                            // Handle ask prompt
                            setAskPrompt(data.question);
                            setCurrentAskId(data.id);
                            setAskResponse(data.defaultValue || '');
                            setAskOptions({
                                defaultValue: data.defaultValue,
                                options: data.options
                            });
                        } else {
                            setTerminalOutput(prev => [...prev, {
                                type: data.type,
                                text: data.text,
                                html: data.html, // Include HTML field for ANSI rendering
                                timestamp: newTimestamp
                            }]);
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
                        text: \`❌ Error: \${error.message}\`,
                        timestamp: new Date().toLocaleTimeString()
                    }]);
                    setExecuting(false);
                }
            };

            const handleCommandClick = (cmd) => {
                setSelectedCommand(cmd);
                setCommandInput(cmd.name);
            };

            const clearTerminal = () => {
                setTerminalOutput([
                    { type: 'system', text: '🍲 Terminal cleared', timestamp: new Date().toLocaleTimeString() }
                ]);
            };

            const handleAskSubmit = async () => {
                if (!askResponse.trim()) return;

                try {
                    const response = await fetch('/api/ask', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            askId: currentAskId,
                            response: askResponse
                        })
                    });

                    if (response.ok) {
                        // Clear ask modal
                        setAskPrompt(null);
                        setCurrentAskId(null);
                        setAskResponse('');

                        // Add user response to terminal
                        const timestamp = new Date().toLocaleTimeString();
                        setTerminalOutput(prev => [...prev, {
                            type: 'info',
                            text: \`📝 User input: \${askResponse}\`,
                            timestamp: timestamp
                        }]);
                    }
                } catch (error) {
                    console.error('Failed to submit ask response:', error);
                }
            };

            return (
                <>
                <div style={{ fontFamily: 'Courier New, monospace', backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#e0e0e0' }}>
                    {/* Header */}
                    <div style={{ backgroundColor: '#fbbf24', borderBottom: '4px solid #1a1a1a', padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '36px', height: '36px', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #000', fontSize: '1.5rem' }}>
                                🍲
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: '900', lineHeight: 1, color: '#000' }}>BUNOSH</div>
                                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#1a1a1a' }}>MODERN TASK RUNNER</div>
                            </div>
                            <button className="neo-brutal-button" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ⚙️ CONFIG
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', height: 'calc(100vh - 80px)' }}>
                        {/* Commands List */}
                        <div style={{ backgroundColor: '#1a1a1a', borderRight: '4px solid #2a2a2a', width: '280px', flexShrink: 0, overflow: 'auto', padding: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fbbf24', marginBottom: '1rem', letterSpacing: '0.05em' }}>COMMANDS</div>
                            {Object.entries(commands).map(([group, cmds]) => (
                                <div key={group} style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.875rem', fontWeight: '700', color: '#fbbf24', marginBottom: '0.5rem' }}>{group.toUpperCase()}</div>
                                    {cmds.map((cmd) => (
                                        <button
                                            key={cmd.name}
                                            onClick={() => handleCommandClick(cmd)}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                backgroundColor: selectedCommand?.name === cmd.name ? '#fbbf24' : '#2a2a2a',
                                                color: selectedCommand?.name === cmd.name ? '#000' : '#e0e0e0',
                                                border: selectedCommand?.name === cmd.name ? '3px solid #fbbf24' : '2px solid #3a3a3a',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontWeight: selectedCommand?.name === cmd.name ? '700' : '400',
                                                fontSize: '0.875rem',
                                                marginBottom: '0.25rem',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <div style={{ fontFamily: 'Courier New, monospace', marginBottom: '0.25rem' }}>{cmd.name}</div>
                                            <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{cmd.description}</div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Command Input */}
                        <div style={{ backgroundColor: '#141414', borderRight: '4px solid #2a2a2a', width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '3px solid #2a2a2a' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fbbf24', marginBottom: '1rem', letterSpacing: '0.05em' }}>COMMAND INPUT</div>

                                {selectedCommand && (
                                    <div style={{ backgroundColor: '#1a1a1a', border: '3px solid #2a2a2a', padding: '1rem', marginBottom: '1rem' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: '#fbbf24', fontFamily: 'Courier New, monospace' }}>
                                            {selectedCommand.name}
                                        </div>
                                        <div style={{ fontSize: '0.875rem', marginBottom: '1rem', opacity: 0.8 }}>
                                            {selectedCommand.description}
                                        </div>
                                    </div>
                                )}

                                <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#fbbf24', fontWeight: '700', fontSize: '1rem' }}>$</div>
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
                                            border: '3px solid #fbbf24',
                                            color: '#e0e0e0',
                                            fontSize: '1rem',
                                            fontFamily: 'Courier New, monospace',
                                            outline: 'none',
                                            boxShadow: '4px 4px 0px 0px rgba(251,191,36,0.3)'
                                        }}
                                    />
                                </div>

                                <button
                                    onClick={executeCommand}
                                    disabled={executing || !commandInput.trim()}
                                    className="neo-brutal-button"
                                    style={{
                                        width: '100%',
                                        marginTop: '1rem',
                                        backgroundColor: executing ? '#3a3a3a' : '#fbbf24',
                                        opacity: executing || !commandInput.trim() ? 0.5 : 1,
                                        cursor: executing || !commandInput.trim() ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    {executing ? '⏳ EXECUTING...' : '▶️ EXECUTE'}
                                </button>

                                <div style={{ marginTop: '1rem' }}>
                                    <button
                                        onClick={clearTerminal}
                                        className="neo-brutal-button"
                                        style={{ backgroundColor: '#374151', color: '#e0e0e0', width: '100%', justifyContent: 'center' }}
                                    >
                                        🗑️ Clear Terminal
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Terminal Output */}
                        <div style={{ backgroundColor: '#0a0a0a', flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1rem 1.5rem', backgroundColor: '#141414', borderBottom: '3px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fbbf24', letterSpacing: '0.05em' }}>TERMINAL OUTPUT</div>
                                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', border: '2px solid #1a1a1a' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#10b981' }}>READY</span>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', fontFamily: 'Courier New, monospace', fontSize: '0.875rem', lineHeight: 1.6 }}>
                                {terminalOutput.map((line, idx) => (
                                    <div key={idx} style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#666', fontSize: '0.75rem', minWidth: '60px', flexShrink: 0 }}>{line.timestamp}</span>
                                        <div style={{
                                            color: line.type === 'command' ? '#fbbf24' :
                                                   line.type === 'success' ? '#10b981' :
                                                   line.type === 'error' ? '#ef4444' :
                                                   line.type === 'info' ? '#06b6d4' :
                                                   '#e0e0e0',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            {line.html ? (
                                                <span dangerouslySetInnerHTML={{ __html: line.html }} />
                                            ) : (
                                                line.text
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

            {/* Ask Modal */}
            {askPrompt && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }}>
                    <div style={{
                        backgroundColor: '#1a1a1a',
                        border: '4px solid #fbbf24',
                        borderRadius: '0.5rem',
                        padding: '2rem',
                        width: '90%',
                        maxWidth: '500px',
                        boxShadow: '8px 8px 0px 0px rgba(251,191,36,0.3)'
                    }}>
                        <div style={{
                            fontSize: '1.25rem',
                            fontWeight: '700',
                            color: '#fbbf24',
                            marginBottom: '1rem',
                            fontFamily: 'Courier New, monospace'
                        }}>
                            🤔 Input Required
                        </div>

                        <div style={{
                            fontSize: '1rem',
                            color: '#e0e0e0',
                            marginBottom: '1.5rem'
                        }}>
                            {askPrompt}
                        </div>

                        {(() => {
                            // Determine input type based on askOptions
                            const inputType = typeof askOptions.defaultValue === 'boolean' ? 'confirm' :
                                                 (askOptions.options?.choices || Array.isArray(askOptions.defaultValue)) ? 'choices' : 'text';

                            if (inputType === 'confirm') {
                                return (
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAskResponse('true');
                                                handleAskSubmit();
                                            }}
                                            style={{
                                                padding: '0.75rem 2rem',
                                                fontWeight: '600',
                                                border: '2px solid #000000',
                                                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                                backgroundColor: '#fbbf24',
                                                color: '#000000',
                                                fontFamily: 'Courier New, monospace',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            YES
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAskResponse('false');
                                                handleAskSubmit();
                                            }}
                                            style={{
                                                padding: '0.75rem 2rem',
                                                fontWeight: '600',
                                                border: '2px solid #374151',
                                                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                                backgroundColor: '#374151',
                                                color: '#e0e0e0',
                                                fontFamily: 'Courier New, monospace',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            NO
                                        </button>
                                    </div>
                                );
                            }

                            if (inputType === 'choices') {
                                const choices = askOptions.options?.choices || askOptions.defaultValue || [];
                                return (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        {choices.map((choice, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => {
                                                    setAskResponse(choice);
                                                    handleAskSubmit();
                                                }}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    padding: '0.75rem',
                                                    marginBottom: '0.5rem',
                                                    fontWeight: '600',
                                                    border: '2px solid #2a2a2a',
                                                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                                    backgroundColor: '#1a1a1a',
                                                    color: '#e0e0e0',
                                                    fontFamily: 'Courier New, monospace',
                                                    cursor: 'pointer',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                {choice}
                                            </button>
                                        ))}
                                    </div>
                                );
                            }

                            return (
                                <form onSubmit={(e) => { e.preventDefault(); handleAskSubmit(); }}>
                                    <input
                                        type="text"
                                        value={askResponse}
                                        onChange={(e) => setAskResponse(e.target.value)}
                                        placeholder="Enter your response..."
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem',
                                            backgroundColor: '#0a0a0a',
                                            border: '3px solid #2a2a2a',
                                            color: '#e0e0e0',
                                            fontSize: '1rem',
                                            fontFamily: 'Courier New, monospace',
                                            outline: 'none',
                                            marginBottom: '1.5rem',
                                            boxShadow: '2px 2px 0px 0px rgba(42,42,42,0.5)'
                                        }}
                                    />

                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAskPrompt(null);
                                                setCurrentAskId(null);
                                                setAskResponse('');
                                            }}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontWeight: '600',
                                                border: '2px solid #374151',
                                                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                                backgroundColor: '#374151',
                                                color: '#e0e0e0',
                                                fontFamily: 'Courier New, monospace',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            type="submit"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontWeight: '600',
                                                border: '2px solid #000000',
                                                boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)',
                                                backgroundColor: '#fbbf24',
                                                color: '#000000',
                                                fontFamily: 'Courier New, monospace',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            SUBMIT
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>
            )}
                </>
            );
        };

        // Render the app
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<App />);
    </script>
</body>
</html>`;
  }

  handleWebSocketOpen(ws) {
    // WebSocket connection opened
    console.log('WebSocket connection opened');
  }

  handleWebSocketMessage(ws, message) {
    // Handle WebSocket message
    console.log('WebSocket message received:', message);
  }

  handleWebSocketClose(ws) {
    // WebSocket connection closed
    console.log('WebSocket connection closed');
  }

  handleWebSocketError(ws, error) {
    // WebSocket error
    console.error('WebSocket error:', error);
  }

  categorizeCommand(commandName) {
    const name = commandName.toLowerCase();

    if (name.includes('build') || name.includes('test') || name.includes('deploy')) {
      return 'Core';
    } else if (name.includes('dev') || name.includes('start') || name.includes('debug') || name.includes('watch')) {
      return 'Development';
    } else if (name.includes('api')) {
      return 'API';
    } else if (name.includes('db') || name.includes('migrate') || name.includes('seed') || name.includes('backup')) {
      return 'Database';
    } else if (name.includes('git')) {
      return 'Git';
    }

    return 'Core'; // Default category
  }

  extractCommandParams(command) {
    const params = [];

    // Extract required arguments
    Object.keys(command.args).forEach(arg => {
      if (command.args[arg] === undefined) {
        params.push(`<${arg}>`);
      } else {
        params.push(`[${arg}=${command.args[arg]}]`);
      }
    });

    // Extract options
    Object.keys(command.opts).forEach(opt => {
      if (command.opts[opt] === false || command.opts[opt] === null) {
        params.push(`--${opt}`);
      } else {
        params.push(`--${opt}=${command.opts[opt]}`);
      }
    });

    return params;
  }
}

export { BunoshWebServer };