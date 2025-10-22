import { TaskResult, createTaskInfo, finishTaskInfo, getCurrentTaskId, runningTasks } from '../task.js';
import Printer from '../printer.js';

const isBun = typeof Bun !== 'undefined';

export default function exec(strings, ...values) {
  // Check if called as regular function instead of template literal
  if (!Array.isArray(strings)) {
    // If first argument is a string, treat it as the command
    if (typeof strings === 'string') {
      strings = [strings];
      values = [];
    } else {
      throw new Error('exec() must be called as a template literal: exec`command` or exec("command")');
    }
  }

  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || '');
  }, '');

  let envs = null;
  let cwd = null;

  const cmdPromise = new Promise(async (resolve, reject) => {
    // Wait for the next event loop tick to ensure .env() and .cwd() have been called
    await new Promise(resolve => setTimeout(resolve, 0));

    const currentTaskId = getCurrentTaskId();

    // Check if parent task is silent
    let isParentSilent = false;
    if (currentTaskId) {
      const parentTask = runningTasks.get(currentTaskId);
      if (parentTask && parentTask.isSilent) {
        isParentSilent = true;
      }
    }

    const extraInfo = {};
    if (cwd) extraInfo.cwd = cwd;
    if (envs) extraInfo.env = envs;

    const taskInfo = createTaskInfo(cmd, currentTaskId, isParentSilent);
    const printer = new Printer('exec', taskInfo.id);
    printer.start(cmd, extraInfo);

    try {
      if (global.disableBunForTesting || !isBun) {
        const result = await nodeExec(cmd, extraInfo, printer, taskInfo);
        if (result.status === 'success') {
          finishTaskInfo(taskInfo, true, null, result.output);
          resolve(result);
        } else {
          finishTaskInfo(taskInfo, false, new Error(result.output), result.output);
          resolve(result);
        }
        return;
      }

      // Bun implementation with real-time streaming
      const needsShell = cmd.includes('|') || cmd.includes('>') || cmd.includes('<') || cmd.includes('&&') || cmd.includes('||') || cmd.includes("'") || cmd.includes('"') || cmd.includes(';');

      const { spawn } = Bun;
      const proc = spawn({
        cmd: needsShell ? ['/bin/sh', '-c', cmd] : cmd.trim().split(/\s+/),
        cwd: cwd || process.cwd(),
        env: {
          ...(envs ? { ...process.env, ...envs } : process.env),
        },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore"
      });

      const decoder = new TextDecoder();
      let output = '';
      let stdout = '';
      let stderr = '';
      let finished = false;

      // Process stdout
      const readStdout = async () => {
        const reader = proc.stdout.getReader();
        let buffer = '';

        try {
          while (!finished) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            buffer += text;

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.trim()) {
                printer.output(line);
                output += line + '\n';
                stdout += line + '\n';
              }
            }
          }

          if (buffer.trim()) {
            printer.output(buffer);
            output += buffer + '\n';
            stdout += buffer + '\n';
          }
        } finally {
          reader.releaseLock();
        }
      };

      // Process stderr
      const readStderr = async () => {
        const reader = proc.stderr.getReader();
        let buffer = '';

        try {
          while (!finished) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            buffer += text;

            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line.trim()) {
                printer.output(line, true);
                output += line + '\n';
                stderr += line + '\n';
              }
            }
          }

          if (buffer.trim()) {
            printer.output(buffer, true);
            output += buffer + '\n';
            stderr += buffer + '\n';
          }
        } finally {
          reader.releaseLock();
        }
      };

      // Start reading both streams
      const [, , exitResult] = await Promise.all([
        readStdout(),
        readStderr(),
        proc.exited
      ]);

      finished = true;
      const exitCode = parseInt(exitResult, 10);

      const metadata = {
        taskType: 'exec',
        exitCode,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };

      if (exitCode === 0) {
        printer.finish(cmd);
        finishTaskInfo(taskInfo, true, null, output.trim());
        resolve(TaskResult.success(output.trim(), metadata));
      } else {
        const error = new Error(`Exit code: ${exitCode}`);
        printer.error(cmd, null, { exitCode });
        finishTaskInfo(taskInfo, false, error, output.trim());
        resolve(TaskResult.fail(output.trim(), metadata));
      }
    } catch (error) {
      printer.error(cmd, error);
      finishTaskInfo(taskInfo, false, error, error.message);
      resolve(TaskResult.fail(error.message, { taskType: 'exec' }));
    }
  });

  cmdPromise.env = (newEnvs) => {
    envs = newEnvs;
    return cmdPromise;
  };

  cmdPromise.cwd = (newCwd) => {
    cwd = newCwd;
    return cmdPromise;
  };

  return cmdPromise;
}

async function nodeExec(cmd, extraInfo, printer, taskInfo) {
  // Node.js fallback - simple execution without real-time output
  const { spawn } = await import('child_process');
  
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      cwd: extraInfo.cwd || process.cwd(),
      env: extraInfo.env ? { ...process.env, ...extraInfo.env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      printer.output(text.trim());
      output += text;
      stdout += text;
    });
    
    proc.stderr.on('data', (data) => {
      const text = data.toString();
      printer.output(text.trim(), true);
      output += text;
      stderr += text;
    });
    
    proc.on('close', (code) => {
      const combinedOutput = (output).trim();
      const metadata = {
        taskType: 'exec',
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
      
      if (code === 0) {
        printer.finish(cmd);
        resolve(TaskResult.success(combinedOutput, metadata));
      } else {
        printer.error(cmd, new Error(`Exit code: ${code}`));
        resolve(TaskResult.fail(combinedOutput, metadata));
      }
    });
    
    proc.on('error', (error) => {
      printer.error(cmd, error);
      resolve(TaskResult.fail(error.message, { taskType: 'exec' }));
    });
  });
}
