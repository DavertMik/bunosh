import { spawn } from 'child_process';
import { BUNOSH_BINARY } from './test-env.js';

/**
 * Executes a bunosh command and returns the result
 */
export async function runBunoshCommand(args, options = {}) {
  return new Promise((resolve) => {
    const { cwd, timeout = 15000, env = {} } = options;
    
    // Choose runtime based on environment variable or default to node
    const runtime = process.env.BUNOSH_RUNTIME || 'node';
    const runtimeCmd = runtime === 'bun' ? 'bun' : 'node';
    
    const proc = spawn(runtimeCmd, [BUNOSH_BINARY, ...args.split(' ')], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Set timeout
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        success: code === 0 && !timedOut
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: stdout.trim(),
        stderr: error.message,
        timedOut: false,
        success: false,
        error
      });
    });
  });
}

/**
 * Executes a system command (not bunosh)
 */
export async function runSystemCommand(command, options = {}) {
  return new Promise((resolve) => {
    const { cwd, timeout = 10000, env = {} } = options;
    
    const proc = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGKILL');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut,
        success: code === 0 && !timedOut
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: -1,
        stdout: stdout.trim(),
        stderr: error.message,
        timedOut: false,
        success: false,
        error
      });
    });
  });
}

/**
 * Helper to check if bunosh binary is available
 */
export async function checkBunoshAvailable() {
  const result = await runBunoshCommand('--help', { timeout: 5000 });
  return result.success;
}