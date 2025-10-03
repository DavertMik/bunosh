import { spawn } from 'child_process';
import path from 'path';
import { BUNOSH_BINARY, createTempTestDir, cleanupTempDir, createTestBunoshfile } from './test-env.js';

/**
 * Executes a bunosh command with inline script using -e flag
 */
export async function runBunoshScript(script, options = {}) {
  return new Promise((resolve) => {
    const { cwd, timeout = 15000, env = {} } = options;
    
    // Choose runtime based on environment variable or default to bun
    const runtime = process.env.BUNOSH_RUNTIME || 'bun';
    const runtimeCmd = runtime === 'bun' ? 'bun' : 'node';
    
    const proc = spawn(runtimeCmd, [BUNOSH_BINARY, '-e'], {
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

    // Write the script to stdin
    proc.stdin.write(script);
    proc.stdin.end();
  });
}

/**
 * Executes a bunosh command and returns the result
 */
export async function runBunoshCommand(args, options = {}) {
  return new Promise((resolve) => {
    const { cwd, timeout = 15000, env = {} } = options;
    
    // Always use bun runtime for e2e tests
    const runtimeCmd = 'bun';
    
    // Handle args - if string, split by spaces; if already array, use as-is
    const argsArray = typeof args === 'string'
      ? args.split(' ').filter(arg => arg.length > 0)
      : args;

    // Add --bunoshfile flag to ensure proper directory isolation
    // Point to the Bunoshfile.js specifically, not just the directory
    const bunoshfilePath = path.join(cwd, 'Bunoshfile.js');
    const finalArgs = ['--bunoshfile', bunoshfilePath, ...argsArray];

    // Use the local bunosh.js from this repository
    const proc = spawn(runtimeCmd, [BUNOSH_BINARY, ...finalArgs], {
      cwd,
      env: { ...process.env, ...env, NODE_ENV: 'test' },
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
  // Try to use bunosh directly without requiring bun runtime
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      const proc = spawn('bunosh', ['--help'], { 
        stdio: ['pipe'],
        timeout: 5000 
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        resolve(code === 0);
      });
      
      proc.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}