import { TaskResult, registerTaskExecution } from '../task.js';
import Printer from '../printer.js';

const isBun = typeof Bun !== 'undefined';

export default function exec(strings, ...values) {
  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || '');
  });

  let envs = null;
  let cwd = null;

  const cmdPromise = new Promise(async (resolve, reject) => {
    const extraInfo = {};
    if (cwd) extraInfo.cwd = cwd;
    if (envs) extraInfo.env = envs;

    const printer = new Printer('exec');
    printer.start(cmd, extraInfo);

    try {
      if (!Bun) {
        return nodeExec(cmd, extraInfo);
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
              }
            }
          }

          if (buffer.trim()) {
            printer.output(buffer);
            output += buffer + '\n';
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
              }
            }
          }

          if (buffer.trim()) {
            printer.output(buffer, true);
            output += buffer + '\n';
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

      if (exitCode === 0) {
        printer.finish(cmd);
        registerTaskExecution(cmd, true);
        resolve(TaskResult.success(output.trim()));
      } else {
        printer.error(cmd, null, { exitCode });
        registerTaskExecution(cmd, false, new Error(`Exit code: ${exitCode}`));
        resolve(TaskResult.fail(output.trim()));
      }
    } catch (error) {
      printer.error(cmd, error);
      registerTaskExecution(cmd, false, error);
      resolve(TaskResult.fail(error.message));
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

async function nodeExec(cmd, extraInfo, printer)      // Node.js fallback - simple execution without real-time output
{
  const { execSync } = await import('child_process');
  try {
    const output = execSync(cmd, {
      cwd: cwd || process.cwd(),
      env: envs ? { ...process.env, ...envs } : process.env,
      encoding: 'utf8'
    });
    if (output.trim()) {
      printer.output(output.trim());
    }
    printer.finish(cmd);
    registerTaskExecution(cmd, true);
    return resolve(TaskResult.success(output.trim()));
  } catch (error) {
    if (error.stdout) printer.output(error.stdout);
    if (error.stderr) printer.output(error.stderr, true);
    printer.error(cmd, error);
    registerTaskExecution(cmd, false, error);
    return resolve(TaskResult.fail(error.message));
  }
}
