import { readFileSync, existsSync } from 'fs';
import path from 'path';
import babelParser from "@babel/parser";
import traverseDefault from "@babel/traverse";
import Convert from 'ansi-to-html';

const traverse = traverseDefault.default || traverseDefault;

function camelToDasherize(camelCaseString) {
  return camelCaseString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

class BunoshWebServer {
  constructor(port = 7171, host = '127.0.0.1') {
    this.port = port;
    this.host = host;
    this.server = null;
    this.clients = new Set();
    this.commands = {};
    this.bunoshSource = '';
    this.pendingAskPromises = new Map();
    this.ansiConverter = new Convert({
      fg: '#e5e5e5',
      bg: '#1a1a1a',
      newline: false,
      escapeXML: true,
      stream: false
    });
  }

  async start() {
    await this.loadCommands();

    this.server = Bun.serve({
      port: this.port,
      hostname: this.host,
      fetch: (req, server) => this.handleRequest(req, server),
      websocket: {
        message: (ws, data) => this.handleWebSocketMessage(ws, data),
        open: (ws) => this.clients.add(ws),
        close: (ws) => this.clients.delete(ws),
      },
    });

    console.log(`Bunosh UI server running at http://${this.host}:${this.port}`);
  }

  async loadCommands() {
    const BUNOSHFILE = 'Bunoshfile.js';
    const bunoshfilePath = path.join(process.cwd(), BUNOSHFILE);

    if (!existsSync(bunoshfilePath)) {
      throw new Error(`Bunoshfile not found: ${bunoshfilePath}`);
    }

    this.bunoshfilePath = bunoshfilePath;
    this.bunoshSource = readFileSync(bunoshfilePath, 'utf-8');
    const tasks = await import(bunoshfilePath);

    this.commands = this.parseCommands(tasks, this.bunoshSource);
  }

  parseCommands(tasks, source) {
    const commands = {};
    let completeAst;

    try {
      completeAst = babelParser.parse(source, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (parseError) {
      throw new Error(`Failed to parse Bunoshfile: ${parseError.message}`);
    }

    const comments = this.fetchComments(completeAst, source);

    Object.keys(tasks).forEach((fnName) => {
      if (typeof tasks[fnName] !== 'function') return;

      const fnBody = tasks[fnName].toString();
      const ast = this.fetchFnAst(fnName, completeAst, fnBody);
      const args = this.parseArgs(fnName, ast);
      const opts = this.parseOpts(fnName, ast);
      const comment = comments[fnName];
      const commandName = this.prepareCommandName(fnName);

      commands[commandName] = {
        name: commandName,
        originalName: fnName,
        description: comment?.split('\n')[0] || '',
        args,
        opts,
        code: this.fetchFnSource(fnName, completeAst, source),
        fn: tasks[fnName]
      };
    });

    return commands;
  }

  fetchComments(completeAst, source) {
    const comments = {};
    let startFromLine = 0;

    traverse(completeAst, {
      FunctionDeclaration(path) {
        const functionName = path.node.id && path.node.id.name;

        const commentSource = source
          .split("\n")
          .slice(startFromLine, path.node?.loc?.start?.line)
          .join("\n");
        const matches = commentSource.match(
          /\/\*\*\s([\s\S]*)\\*\/\s*export/,
        );

        if (matches && matches[1]) {
          comments[functionName] = matches[1]
            .replace(/^\s*\*\s*/gm, "")
            .replace(/\s*\*\*\s*$/gm, "")
            .trim()
            .replace(/^@.*$/gm, "")
            .trim();
        } else {
          const firstStatement = path.node?.body?.body?.[0];
          const leadingComments = firstStatement?.leadingComments;

          if (leadingComments && leadingComments.length > 0) {
            comments[functionName] = leadingComments[0].value.trim();
          }
        }

        startFromLine = path.node?.loc?.end?.line;
      },
    });

    return comments;
  }

  fetchFnAst(fnName, completeAst, fnBody) {
    let hasFnInSource = false;

    traverse(completeAst, {
      FunctionDeclaration(path) {
        if (path.node.id.name == fnName) {
          hasFnInSource = true;
          return;
        }
      },
    });

    if (hasFnInSource) return completeAst;
    return babelParser.parse(fnBody, { comment: true, tokens: true });
  }

  fetchFnSource(fnName, completeAst, source) {
    let code = '';
    traverse(completeAst, {
      FunctionDeclaration(path) {
        if (path.node.id?.name !== fnName) return;
        const target = path.parentPath && path.parentPath.isExportNamedDeclaration()
          ? path.parentPath.node
          : path.node;
        let startOffset = target.start;
        const lead = target.leadingComments;
        if (lead && lead.length) startOffset = lead[0].start;
        code = source.slice(startOffset, target.end).trim();
        path.stop();
      },
    });
    return code;
  }

  parseArgs(fnName, ast) {
    const functionArguments = {};

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id.name !== fnName) return;

        path.node.params
          .filter((node) => {
            return node?.right?.type !== "ObjectExpression";
          })
          .forEach((param) => {
            if (param.type === "AssignmentPattern") {
              functionArguments[param.left.name] = param.right.value;
              return;
            }
            if (!param.name) return;
            functionArguments[param.name] = null;
          });
      },
    });

    return functionArguments;
  }

  parseOpts(fnName, ast) {
    let functionOpts = {};

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id.name !== fnName) return;

        const node = path.node.params.pop();
        if (!node) return;
        if (
          !node.type === "AssignmentPattern" &&
          node.right.type === "ObjectExpression"
        )
          return;

        node?.right?.properties?.forEach((p) => {
          if (
            ["NumericLiteral", "StringLiteral", "BooleanLiteral"].includes(
              p.value.type,
            )
          ) {
            functionOpts[camelToDasherize(p.key.name)] = p.value.value;
            return;
          }

          if (p.value.type === "NullLiteral") {
            functionOpts[camelToDasherize(p.key.name)] = null;
            return;
          }

          if (p.value.type == "UnaryExpression" && p.value.operator == "!") {
            functionOpts[camelToDasherize(p.key.name)] =
              !p.value.argument.value;
            return;
          }
        });
      },
    });

    return functionOpts;
  }

  prepareCommandName(name) {
    name = name
      .split(/(?=[A-Z])/)
      .join("-")
      .toLowerCase();
    return name.replace("-", ":");
  }


  async handleRequest(req, server) {
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
      if (server.upgrade(req)) {
        return;
      }
      return new Response('Upgrade failed', { status: 500 });
    }

    if (req.method === 'GET' && url.pathname === '/') {
      return new Response(this.getIndexHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    } else if (req.method === 'GET' && url.pathname === '/api/commands') {
      return new Response(JSON.stringify(this.commands), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (req.method === 'GET' && url.pathname === '/api/source') {
      return new Response(JSON.stringify({ path: this.bunoshfilePath, source: this.bunoshSource }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (req.method === 'POST' && url.pathname === '/api/execute') {
      return await this.handleExecuteCommand(req);
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }

  async handleExecuteCommand(req) {
    try {
      const body = await req.text();
      const { command, args, opts } = JSON.parse(body);

      if (!this.commands[command]) {
        return new Response(JSON.stringify({ error: 'Command not found' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const executionId = Date.now().toString();

      this.executeCommand(command, args, opts, executionId);

      return new Response(JSON.stringify({ executionId, status: 'started' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async executeCommand(commandName, args, opts, executionId) {
    const command = this.commands[commandName];

    this.broadcast({
      type: 'execution_start',
      executionId,
      command: commandName
    });

    await import('../index.js');

    const tasksExecuted = globalThis._bunoshGlobalTasksExecuted || [];
    const startIndex = tasksExecuted.length;
    const TaskStatus = globalThis._bunoshGlobalTaskStatus || { FAIL: 'fail', WARNING: 'warning' };

    const originalIsTTY = process.stdout.isTTY;
    const originalStderrIsTTY = process.stderr.isTTY;
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    globalThis._bunoshUIMode = true;
    globalThis._bunoshUIExecutionId = executionId;
    globalThis._bunoshUIServer = this;

    process.env.FORCE_COLOR = '1';
    process.env.TERM = 'xterm-256color';
    process.stdout.isTTY = true;
    process.stderr.isTTY = true;

    console.log = (...args) => {
      const rawMessage = args.join(' ');
      this.emitOutput(executionId, 'info', rawMessage, this.ansiConverter.toHtml(rawMessage));
      originalConsoleLog(...args);
    };

    console.error = (...args) => {
      const rawMessage = args.join(' ');
      this.emitOutput(executionId, 'error', rawMessage, this.ansiConverter.toHtml(rawMessage));
      originalConsoleError(...args);
    };

    const argNames = Object.keys(command.args);
    const positional = argNames.map((name) =>
      (args && Object.prototype.hasOwnProperty.call(args, name)) ? args[name] : command.args[name]
    );

    const invocation = this.formatInvocation(commandName, positional, opts);
    this.logInvocationToTerminal(originalConsoleLog, commandName, argNames, positional, opts, invocation);
    this.emitOutput(executionId, 'info', '$ ' + invocation, '<span style="color:#f0a02e;font-weight:600">$ ' + this.escapeHtml(invocation) + '</span>');

    let status = 'success';
    let errorMessage = null;

    try {
      await command.fn(...positional, opts);
    } catch (error) {
      status = 'error';
      errorMessage = error.message || String(error);
      this.emitOutput(executionId, 'error', errorMessage, '<span style="color:#db5b39">' + this.escapeHtml(errorMessage) + '</span>');
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      process.stdout.isTTY = originalIsTTY;
      process.stderr.isTTY = originalStderrIsTTY;
      globalThis._bunoshUIMode = false;
      globalThis._bunoshUIExecutionId = null;
      globalThis._bunoshUIServer = null;
    }

    const newTasks = tasksExecuted.slice(startIndex);
    const failed = newTasks.filter(t => t.result?.status === TaskStatus.FAIL).length;
    const warnings = newTasks.filter(t => t.result?.status === TaskStatus.WARNING).length;
    if (failed > 0) status = 'error';

    const isError = status === 'error';
    const summary = `🍲 ${isError ? 'FAIL ' : 'OK '}Tasks: ${newTasks.length}${failed ? ` | Failed: ${failed}` : ''}${warnings ? ` | Warnings: ${warnings}` : ''}`;
    this.emitOutput(executionId, isError ? 'error' : 'info', summary, '<span style="color:' + (isError ? '#db5b39' : '#8fb368') + '">' + this.escapeHtml(summary) + '</span>');

    this.broadcast({
      type: 'execution_complete',
      executionId,
      status,
      error: errorMessage,
      failed,
      warnings
    });
  }

  emitOutput(executionId, level, message, html) {
    this.broadcast({ type: 'output', executionId, level, message, html });
  }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  formatInvocation(commandName, positional, opts) {
    const quote = (v) => {
      const s = String(v);
      return /[\s"']/.test(s) ? JSON.stringify(s) : s;
    };
    const isEmpty = (v) => v === null || v === undefined || v === '';

    const parts = ['bunosh', commandName];

    let lastFilled = -1;
    positional.forEach((v, i) => { if (!isEmpty(v)) lastFilled = i; });
    for (let i = 0; i <= lastFilled; i++) {
      parts.push(isEmpty(positional[i]) ? '""' : quote(positional[i]));
    }

    Object.entries(opts || {}).forEach(([k, v]) => {
      if (typeof v === 'boolean') {
        if (v) parts.push('--' + k);
        return;
      }
      if (isEmpty(v)) return;
      parts.push('--' + k + '=' + quote(v));
    });
    return parts.join(' ');
  }

  logInvocationToTerminal(log, commandName, argNames, positional, opts, invocation) {
    log(`\n🍲 ui run: ${commandName}`);
    log(`   → ${invocation}`);
    if (argNames.length > 0) {
      const named = argNames.map((n, i) => `${n}=${JSON.stringify(positional[i])}`).join(', ');
      log(`   positional: ${named}`);
    }
    const optKeys = Object.keys(opts || {});
    if (optKeys.length > 0) {
      const named = optKeys.map((k) => `--${k}=${JSON.stringify(opts[k])}`).join(', ');
      log(`   options: ${named}`);
    }
  }

  handleWebSocketMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'ask_response' && this.pendingAskPromises.has(message.askId)) {
        const resolve = this.pendingAskPromises.get(message.askId);
        this.pendingAskPromises.delete(message.askId);
        resolve(message.value);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  broadcast(message) {
    this.clients.forEach(client => {
      client.send(JSON.stringify(message));
    });
  }

  async askInUI(question, opts = {}) {
    const askId = Date.now().toString() + Math.random();
    const executionId = globalThis._bunoshUIExecutionId;

    return new Promise((resolve) => {
      this.pendingAskPromises.set(askId, resolve);

      this.broadcast({
        type: 'ask_prompt',
        executionId,
        askId,
        question,
        opts
      });
    });
  }

  getIndexHTML() {
    let version = '';
    try {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
      version = pkg.version;
    } catch (e) {}

    const cwd = process.cwd();
    const home = process.env.HOME || '';
    const cwdDisplay = (home && cwd.startsWith(home)) ? '~' + cwd.slice(home.length) : cwd;
    const bunoshfileName = this.bunoshfilePath ? path.basename(this.bunoshfilePath) : 'Bunoshfile.js';
    const meta = JSON.stringify({ cwd, cwdDisplay, file: bunoshfileName });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bunosh</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        :root {
            --bg: #100d09;
            --surface: #1b1610;
            --surface-2: #221c15;
            --border: #2e2720;
            --border-strong: #3b322a;
            --text: #ece3d6;
            --muted: #a99e8d;
            --faint: #6f6557;
            --accent: #f0a02e;
            --accent-soft: rgba(240,160,46,.12);
            --accent-line: rgba(240,160,46,.45);
            --success: #8fb368;
            --danger: #db5b39;
            --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
            --sans: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
        }
        * { box-sizing: border-box; }
        html, body, #root { height: 100%; margin: 0; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: var(--mono);
            font-size: 14px;
            -webkit-font-smoothing: antialiased;
        }
        body::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 0;
            background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='1.5' cy='1.5' r='1' fill='%23f0a02e' fill-opacity='0.05'/></svg>");
            background-size: 24px 24px;
        }
        #root { position: relative; z-index: 1; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: #332b22; border-radius: 6px; }
        ::-webkit-scrollbar-thumb:hover { background: #463b2e; }
        ::-webkit-scrollbar-track { background: transparent; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        .reveal { opacity: 0; animation: fadeUp .5s cubic-bezier(.2,.7,.2,1) forwards; }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; animation: none; } }

        .app { height: 100%; display: flex; flex-direction: column; border-top: 3px solid var(--accent); }
        .topbar { display: flex; align-items: center; justify-content: space-between; height: 60px; padding: 0 22px; border-bottom: 1px solid var(--border); background: var(--surface); }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand-mark { font-size: 24px; line-height: 1; }
        .brand-name { font-family: var(--sans); font-weight: 700; font-size: 23px; letter-spacing: -.02em; }
        .brand-ver { font-family: var(--mono); font-size: 11px; color: var(--accent); border: 1px solid var(--accent-line); border-radius: 999px; padding: 2px 8px; }
        .status { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
        .status .addr { color: var(--faint); text-transform: none; letter-spacing: 0; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--faint); display: inline-block; flex-shrink: 0; }
        .dot--running { background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
        .dot--success { background: var(--success); }
        .dot--error, .dot--offline { background: var(--danger); }

        .body { flex: 1; display: flex; min-height: 0; }
        .sidebar { width: 282px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); background: #161109; }
        .search { padding: 14px; border-bottom: 1px solid var(--border); }
        .search-box { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--bg); transition: border-color .15s; }
        .search-box:focus-within { border-color: var(--accent-line); }
        .search-box input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: var(--text); font-family: var(--mono); font-size: 13px; caret-color: var(--accent); }
        .search-box input::placeholder { color: var(--faint); }
        .search-box kbd { font-family: var(--mono); font-size: 10px; color: var(--faint); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 5px; }
        .cmd-list { flex: 1; overflow-y: auto; padding: 8px; }
        .cmd { display: block; width: 100%; text-align: left; padding: 9px 12px; margin-bottom: 2px; border: none; border-left: 2px solid transparent; border-radius: 8px; background: transparent; cursor: pointer; transition: background .14s, border-color .14s; }
        .cmd:hover { background: var(--accent-soft); }
        .cmd.is-active { background: var(--accent-soft); border-left-color: var(--accent); }
        .cmd-name { font-family: var(--mono); font-size: 13px; color: var(--text); }
        .cmd.is-active .cmd-name { color: var(--accent); }
        .cmd-desc { font-size: 11px; color: var(--faint); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sidebar-foot { padding: 10px 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--faint); letter-spacing: .04em; }
        .no-match { padding: 28px 12px; text-align: center; color: var(--faint); font-size: 13px; }

        .main { flex: 1; min-width: 0; overflow-y: auto; }
        .detail { max-width: 760px; margin: 0 auto; padding: 34px 28px; }
        .cmd-title { font-family: var(--mono); font-size: 24px; font-weight: 500; color: var(--text); letter-spacing: -.01em; margin: 0; }
        .cmd-sub { font-family: var(--sans); font-size: 16px; color: var(--muted); margin: 7px 0 0; }
        .panel { margin-top: 24px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); padding: 20px; box-shadow: 0 18px 40px -28px rgba(0,0,0,.85); }
        .field + .field { margin-top: 16px; }
        .field-label { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; font-family: var(--mono); font-size: 13px; color: var(--accent); }
        .badge { font-size: 9px; text-transform: uppercase; letter-spacing: .1em; padding: 2px 6px; border-radius: 5px; }
        .badge--req { color: var(--danger); background: rgba(219,91,57,.14); }
        .badge--opt { color: var(--muted); background: rgba(169,158,141,.14); }
        .input { width: 100%; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--bg); color: var(--text); font-family: var(--mono); font-size: 13px; outline: none; transition: border-color .15s; }
        .input:focus { border-color: var(--accent-line); }
        .input::placeholder { color: var(--faint); }
        .check { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; font-family: var(--mono); font-size: 13px; color: var(--accent); }
        .check input { width: 16px; height: 16px; accent-color: var(--accent); }
        .no-args { color: var(--faint); font-size: 13px; margin-top: 20px; }
        .actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
        .btn { font-family: var(--mono); font-weight: 500; font-size: 13px; letter-spacing: .02em; padding: 11px 18px; border-radius: 10px; border: 1px solid transparent; cursor: pointer; transition: transform .12s, background .15s, color .15s, border-color .15s; }
        .btn--primary { background: var(--accent); color: #1a1206; box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 12px 26px -14px rgba(240,160,46,.7); }
        .btn--primary:hover { background: #ffb648; transform: translateY(-1px); }
        .btn--primary:active { transform: translateY(0); }
        .btn--primary:disabled { background: var(--surface-2); color: var(--faint); box-shadow: none; cursor: not-allowed; transform: none; }
        .btn--ghost { background: transparent; color: var(--muted); border-color: var(--border-strong); }
        .btn--ghost:hover { color: var(--text); background: var(--accent-soft); border-color: var(--accent-line); }

        .output { margin-top: 24px; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: #0b0a07; }
        .output-head { display: flex; align-items: center; justify-content: space-between; padding: 9px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .output-head .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); }
        .output-status { display: flex; align-items: center; gap: 7px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
        .output-body { padding: 16px; font-family: var(--mono); font-size: 13px; line-height: 1.65; white-space: pre-wrap; word-break: break-word; overflow-y: auto; max-height: 56vh; color: #e7ddd0; }

        .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 24px; }
        .empty-mark { font-size: 54px; margin-bottom: 18px; }
        .empty h2 { font-family: var(--sans); font-weight: 600; font-size: 26px; color: var(--text); margin: 0; letter-spacing: -.01em; }
        .empty p { font-family: var(--sans); color: var(--muted); max-width: 390px; margin: 11px 0 0; font-size: 15px; line-height: 1.55; }
        .empty .hint { margin-top: 20px; font-size: 12px; color: var(--faint); }
        .empty kbd { font-family: var(--mono); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 6px; color: var(--muted); }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(8,6,3,.7); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; }
        .modal { width: 100%; max-width: 440px; border: 1px solid var(--border-strong); border-radius: 18px; background: var(--surface); padding: 24px; box-shadow: 0 30px 60px -20px rgba(0,0,0,.85); }
        .modal-title { font-family: var(--sans); font-weight: 600; font-size: 19px; color: var(--text); margin: 0 0 18px; }
        .modal-row { display: flex; gap: 12px; }
        .modal-row .btn { flex: 1; }
        .choices { display: flex; flex-direction: column; gap: 8px; }
        .choice { font-family: var(--mono); font-size: 13px; text-align: left; padding: 11px 14px; border: 1px solid var(--border-strong); border-radius: 10px; background: var(--bg); color: var(--text); cursor: pointer; transition: border-color .15s, background .15s; }
        .choice:hover { border-color: var(--accent-line); background: var(--accent-soft); }
        .modal .input { margin-bottom: 16px; }

        .meta { display: flex; align-items: center; gap: 14px; min-width: 0; font-size: 12px; color: var(--muted); }
        .meta-cwd { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 40ch; }
        .meta-file { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 12px; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--accent-line); border-radius: 999px; padding: 3px 11px; cursor: pointer; transition: background .15s; white-space: nowrap; flex-shrink: 0; }
        .meta-file:hover { background: rgba(240,160,46,.2); }

        .detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .detail-head-text { min-width: 0; }
        .btn--sm { padding: 7px 13px; font-size: 12px; }
        .code-toggle { flex-shrink: 0; }
        .code-block { margin-top: 20px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 12px; background: #0b0a07; color: #e7ddd0; font-family: var(--mono); font-size: 12.5px; line-height: 1.6; overflow: auto; max-height: 440px; white-space: pre; tab-size: 2; }

        .modal-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        .modal-close { background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 16px; line-height: 1; padding: 4px 6px; border-radius: 6px; }
        .modal-close:hover { color: var(--text); background: var(--accent-soft); }
        .modal--code { max-width: 820px; }
        .modal--code .code-block { margin-top: 0; max-height: 70vh; }

        .code-block code.hljs { background: transparent; padding: 0; color: #e7ddd0; }
        .hljs-comment, .hljs-quote { color: #6f6557; font-style: italic; }
        .hljs-keyword, .hljs-literal, .hljs-selector-tag, .hljs-section, .hljs-doctag, .hljs-name { color: #f0a02e; }
        .hljs-title, .hljs-title.function_, .hljs-title.class_ { color: #f3cf8c; }
        .hljs-string, .hljs-regexp, .hljs-meta .hljs-string, .hljs-addition { color: #9ec27a; }
        .hljs-number, .hljs-symbol, .hljs-bullet { color: #e08a5a; }
        .hljs-built_in, .hljs-type, .hljs-builtin-name { color: #d8a85e; }
        .hljs-attr, .hljs-attribute, .hljs-property, .hljs-variable, .hljs-template-variable, .hljs-params { color: #cdbfa6; }
        .hljs-operator, .hljs-punctuation { color: #a99e8d; }
        .hljs-emphasis { font-style: italic; }
        .hljs-strong { font-weight: 700; }

        .shortcuts { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 8px 22px; border-top: 1px solid var(--border); background: var(--surface); font-size: 11px; color: var(--faint); flex-shrink: 0; }
        .shortcuts .sc { display: flex; align-items: center; gap: 5px; }
        .shortcuts kbd { font-family: var(--mono); font-size: 10px; color: var(--muted); background: var(--bg); border: 1px solid var(--border-strong); border-radius: 5px; padding: 1px 6px; }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="text/babel" data-type="module">
        const { useState, useEffect, useRef } = React;

        const META = ${meta};

        function CodeBlock({ code }) {
            const hl = (window.hljs && code) ? window.hljs.highlight(code, { language: "javascript" }).value : null;
            if (hl) {
                return <pre className="code-block"><code className="hljs" dangerouslySetInnerHTML={{ __html: hl }} /></pre>;
            }
            return <pre className="code-block"><code className="hljs">{code}</code></pre>;
        }

        function AskModal({ prompt, onAnswer }) {
            const [value, setValue] = useState(prompt.opts.default || "");
            const isConfirm = prompt.opts.type === "confirm";
            const choices = prompt.opts.choices;
            const submit = (e) => { e.preventDefault(); onAnswer(value); };

            return (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3 className="modal-title">{prompt.question}</h3>
                        {isConfirm ? (
                            <div className="modal-row">
                                <button className="btn btn--primary" onClick={() => onAnswer(true)}>Yes</button>
                                <button className="btn btn--ghost" onClick={() => onAnswer(false)}>No</button>
                            </div>
                        ) : choices ? (
                            <div className="choices">
                                {choices.map((ch, i) => (
                                    <button key={i} className="choice" onClick={() => onAnswer(ch)}>{ch}</button>
                                ))}
                            </div>
                        ) : (
                            <form onSubmit={submit}>
                                <input
                                    className="input"
                                    autoFocus
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    placeholder={prompt.opts.default || "Type your answer…"}
                                />
                                <div className="modal-row">
                                    <button type="submit" className="btn btn--primary">Submit</button>
                                    <button type="button" className="btn btn--ghost" onClick={() => onAnswer(prompt.opts.default || "")}>Cancel</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            );
        }

        function App() {
            const [commands, setCommands] = useState({});
            const [query, setQuery] = useState("");
            const [selected, setSelected] = useState(null);
            const [formData, setFormData] = useState({});
            const [output, setOutput] = useState("");
            const [isExecuting, setIsExecuting] = useState(false);
            const [runStatus, setRunStatus] = useState("idle");
            const [connected, setConnected] = useState(false);
            const [askPrompt, setAskPrompt] = useState(null);
            const [showCode, setShowCode] = useState(false);
            const [fileOpen, setFileOpen] = useState(false);
            const [fileSource, setFileSource] = useState("");
            const wsRef = useRef(null);
            const outRef = useRef(null);
            const searchRef = useRef(null);
            const listRef = useRef(null);
            const mainRef = useRef(null);
            const pendingFocusRef = useRef(false);

            function onMessage(m) {
                if (m.type === "output") {
                    setOutput((prev) => prev + (m.html || m.message) + "\\n");
                } else if (m.type === "execution_start") {
                    setIsExecuting(true);
                    setRunStatus("running");
                    setOutput("");
                } else if (m.type === "execution_complete") {
                    setIsExecuting(false);
                    setRunStatus(m.status === "error" ? "error" : "success");
                    setAskPrompt(null);
                } else if (m.type === "ask_prompt") {
                    setAskPrompt(m);
                }
            }

            useEffect(() => {
                fetch("/api/commands").then((r) => r.json()).then(setCommands);
                let socket, timer, closed = false;
                const connect = () => {
                    socket = new WebSocket("ws://" + window.location.host + "/ws");
                    socket.onopen = () => setConnected(true);
                    socket.onclose = () => { setConnected(false); setIsExecuting(false); if (!closed) timer = setTimeout(connect, 1500); };
                    socket.onmessage = (e) => onMessage(JSON.parse(e.data));
                    wsRef.current = socket;
                };
                connect();
                return () => { closed = true; clearTimeout(timer); if (socket) socket.close(); };
            }, []);

            useEffect(() => {
                if (!selected || !listRef.current) return;
                const active = listRef.current.querySelector(".cmd.is-active");
                if (active) {
                    active.scrollIntoView({ block: "nearest" });
                    if (pendingFocusRef.current) { active.focus(); pendingFocusRef.current = false; }
                }
            }, [selected]);

            useEffect(() => {
                if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight;
            }, [output]);

            const q = query.trim().toLowerCase();
            const list = Object.values(commands).filter((c) => {
                if (!q) return true;
                return c.name.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q);
            });
            const total = Object.keys(commands).length;

            const select = (c) => { setSelected(c); setFormData({}); setOutput(""); setRunStatus("idle"); setShowCode(false); };

            const run = (e) => {
                if (e) e.preventDefault();
                if (!selected || isExecuting) return;

                const coerce = (raw, def) => {
                    if (typeof def === "number" && raw !== "" && raw !== null && raw !== undefined && !isNaN(Number(raw))) return Number(raw);
                    return raw;
                };

                const missing = Object.keys(selected.args).filter((k) => selected.args[k] === null && (formData[k] === undefined || String(formData[k]).trim() === ""));
                if (missing.length > 0) {
                    setRunStatus("error");
                    setOutput('<span style="color:#db5b39">⚠ Fill required argument' + (missing.length > 1 ? "s" : "") + ": " + missing.join(", ") + "</span>\\n");
                    return;
                }

                const args = {};
                const opts = {};
                Object.keys(selected.args).forEach((k) => {
                    const raw = (formData[k] !== undefined && formData[k] !== "") ? formData[k] : selected.args[k];
                    args[k] = coerce(raw, selected.args[k]);
                });
                Object.keys(selected.opts).forEach((k) => {
                    const raw = formData[k] !== undefined ? formData[k] : selected.opts[k];
                    opts[k] = coerce(raw, selected.opts[k]);
                });
                fetch("/api/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ command: selected.name, args, opts })
                }).catch((err) => setOutput((prev) => prev + "Error: " + err.message + "\\n"));
            };

            const answer = (value) => {
                if (askPrompt && wsRef.current) {
                    wsRef.current.send(JSON.stringify({ type: "ask_response", askId: askPrompt.askId, value }));
                    setAskPrompt(null);
                }
            };

            const clear = () => { setOutput(""); setRunStatus("idle"); };

            const openFile = () => {
                setFileOpen(true);
                if (!fileSource) {
                    fetch("/api/source").then((r) => r.json()).then((d) => setFileSource(d.source || ""));
                }
            };

            const hasParams = selected && (Object.keys(selected.args).length > 0 || Object.keys(selected.opts).length > 0);
            const headStatus = connected ? (runStatus === "idle" ? "ready" : runStatus) : "offline";

            useEffect(() => {
                const focusMain = () => {
                    const main = mainRef.current;
                    const target = main && (main.querySelector(".input") || main.querySelector(".check input") || main.querySelector(".btn--primary"));
                    if (target) target.focus();
                };
                const focusList = () => {
                    const listEl = listRef.current;
                    const target = listEl && (listEl.querySelector(".cmd.is-active") || listEl.querySelector(".cmd"));
                    if (target) target.focus();
                };
                const onKey = (e) => {
                    if (e.key === "Escape" && fileOpen) { setFileOpen(false); return; }

                    const el = document.activeElement;
                    const inField = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
                    const inOtherField = inField && el !== searchRef.current;
                    const noMod = !e.ctrlKey && !e.metaKey && !e.altKey;

                    if (e.key === "/" && noMod) {
                        if (inOtherField) return;
                        e.preventDefault();
                        if (searchRef.current) { searchRef.current.focus(); searchRef.current.select(); }
                        return;
                    }

                    if (e.key === "ArrowRight" && (e.ctrlKey || (noMod && !inField))) {
                        e.preventDefault();
                        focusMain();
                        return;
                    }

                    if (e.key === "ArrowLeft" && (e.ctrlKey || (noMod && !inField))) {
                        e.preventDefault();
                        focusList();
                        return;
                    }

                    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && noMod) {
                        if (askPrompt || list.length === 0) return;
                        if (inOtherField) return;
                        if (mainRef.current && mainRef.current.contains(el)) return;
                        e.preventDefault();
                        const idx = selected ? list.findIndex((c) => c.name === selected.name) : -1;
                        let next = e.key === "ArrowDown" ? idx + 1 : idx - 1;
                        if (next < 0) next = list.length - 1;
                        if (next >= list.length) next = 0;
                        pendingFocusRef.current = !!(el && el.classList && el.classList.contains("cmd"));
                        select(list[next]);
                    }
                };
                window.addEventListener("keydown", onKey);
                return () => window.removeEventListener("keydown", onKey);
            }, [list, selected, askPrompt, fileOpen]);

            return (
                <div className="app">
                    <header className="topbar reveal">
                        <div className="brand">
                            <span className="brand-mark">🍲</span>
                            <span className="brand-name">Bunosh</span>
                            <span className="brand-ver">v${version}</span>
                        </div>
                        <div className="meta">
                            <span className="meta-cwd" title={META.cwd}>📁 {META.cwdDisplay}</span>
                            <button className="meta-file" onClick={openFile} title="View Bunoshfile source">📄 {META.file}</button>
                        </div>
                        <div className="status">
                            <span className={"dot dot--" + (connected ? runStatus : "offline")}></span>
                            <span>{headStatus}</span>
                            <span className="addr">{window.location.host}</span>
                        </div>
                    </header>

                    <div className="body">
                        <aside className="sidebar reveal" style={{ animationDelay: "60ms" }}>
                            <div className="search">
                                <div className="search-box">
                                    <span>🔍</span>
                                    <input
                                        ref={searchRef}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search commands…"
                                        autoFocus
                                    />
                                    <kbd>/</kbd>
                                </div>
                            </div>
                            <div className="cmd-list" ref={listRef}>
                                {list.map((c, i) => (
                                    <button
                                        key={c.name}
                                        className={"cmd reveal" + (selected && selected.name === c.name ? " is-active" : "")}
                                        style={{ animationDelay: (Math.min(i, 18) * 22) + "ms" }}
                                        onClick={() => select(c)}
                                    >
                                        <div className="cmd-name">{c.name}</div>
                                        {c.description ? <div className="cmd-desc">{c.description}</div> : null}
                                    </button>
                                ))}
                                {list.length === 0 ? <div className="no-match">No commands match “{query}”.</div> : null}
                            </div>
                            <div className="sidebar-foot">
                                {list.length === total ? total + " commands" : list.length + " / " + total + " commands"}
                            </div>
                        </aside>

                        <main className="main" ref={mainRef}>
                            {selected ? (
                                <div className="detail reveal" key={selected.name}>
                                    <div className="detail-head">
                                        <div className="detail-head-text">
                                            <h1 className="cmd-title">{selected.name}</h1>
                                            {selected.description ? <p className="cmd-sub">{selected.description}</p> : null}
                                        </div>
                                        {selected.code ? (
                                            <button type="button" className="btn btn--ghost btn--sm code-toggle" onClick={() => setShowCode((s) => !s)}>
                                                {showCode ? "Hide code" : "Show code"}
                                            </button>
                                        ) : null}
                                    </div>

                                    {showCode && selected.code ? <CodeBlock code={selected.code} /> : null}

                                    <form onSubmit={run}>
                                        {hasParams ? (
                                            <div className="panel">
                                                {Object.entries(selected.args).map(([key, def]) => (
                                                    <div className="field" key={key}>
                                                        <label className="field-label">
                                                            <span>{key}</span>
                                                            <span className={"badge " + (def === null ? "badge--req" : "badge--opt")}>{def === null ? "required" : "optional"}</span>
                                                        </label>
                                                        <input
                                                            className="input"
                                                            type="text"
                                                            placeholder={(def !== null && def !== undefined) ? String(def) : "Enter " + key}
                                                            value={formData[key] || ""}
                                                            onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                                        />
                                                    </div>
                                                ))}
                                                {Object.entries(selected.opts).map(([key, def]) => (
                                                    <div className="field" key={key}>
                                                        {typeof def === "boolean" ? (
                                                            <label className="check">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData[key] !== undefined ? formData[key] : def}
                                                                    onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                                                                />
                                                                <span>--{key}</span>
                                                            </label>
                                                        ) : (
                                                            <div>
                                                                <label className="field-label"><span>--{key}</span></label>
                                                                <input
                                                                    className="input"
                                                                    type="text"
                                                                    placeholder={(def !== null && def !== undefined) ? String(def) : "Enter " + key}
                                                                    value={formData[key] || ""}
                                                                    onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="no-args">This command takes no arguments.</p>
                                        )}

                                        <div className="actions">
                                            <button type="submit" className="btn btn--primary" disabled={isExecuting}>
                                                {isExecuting ? "Running…" : "▶ Launch"}
                                            </button>
                                            {output ? <button type="button" className="btn btn--ghost" onClick={clear}>Clear</button> : null}
                                        </div>
                                    </form>

                                    {(output || isExecuting) ? (
                                        <div className="output">
                                            <div className="output-head">
                                                <span className="lbl">Output</span>
                                                <span className="output-status">
                                                    <span className={"dot dot--" + runStatus}></span>
                                                    {runStatus}
                                                </span>
                                            </div>
                                            <div className="output-body" ref={outRef} dangerouslySetInnerHTML={{ __html: output || "" }} />
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="empty">
                                    <div className="empty-mark">🍲</div>
                                    <h2>Pick a command to run</h2>
                                    <p>Search and select a task, fill in its arguments, and hit Launch. Output streams right below.</p>
                                    <div className="hint">Press <kbd>/</kbd> to search</div>
                                </div>
                            )}
                        </main>
                    </div>

                    <footer className="shortcuts">
                        <span className="sc"><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
                        <span className="sc"><kbd>→</kbd> open</span>
                        <span className="sc"><kbd>←</kbd> back</span>
                        <span className="sc"><kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> jump panes</span>
                        <span className="sc"><kbd>/</kbd> search</span>
                        <span className="sc"><kbd>Enter</kbd> run</span>
                        <span className="sc"><kbd>Esc</kbd> close</span>
                    </footer>

                    {askPrompt ? <AskModal prompt={askPrompt} onAnswer={answer} /> : null}

                    {fileOpen ? (
                        <div className="modal-backdrop" onClick={() => setFileOpen(false)}>
                            <div className="modal modal--code" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-head">
                                    <h3 className="modal-title">📄 {META.file}</h3>
                                    <button className="modal-close" onClick={() => setFileOpen(false)} aria-label="Close">✕</button>
                                </div>
                                {fileSource ? <CodeBlock code={fileSource} /> : <pre className="code-block"><code className="hljs">Loading…</code></pre>}
                            </div>
                        </div>
                    ) : null}
                </div>
            );
        }

        ReactDOM.render(<App />, document.getElementById("root"));
    </script>
</body>
</html>`;
  }
}

export default BunoshWebServer;
