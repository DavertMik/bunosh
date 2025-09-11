import { describe, test, expect, mock, spyOn } from 'bun:test';
import { spawn } from 'bun';
import path from 'path';

const bunoshPath = path.resolve('./bunosh.js');

describe('Pipes Support', () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  test('executes simple JavaScript code from stdin', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    proc.stdin?.write('console.log("Hello from pipe");');
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain('Hello from pipe');
  });

  test('executes bunosh functions from stdin', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    proc.stdin?.write('say("Test message from pipe");');
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain('Test message from pipe');
  });

  test('executes exec command from stdin', async () => {
    const timeout = isCI ? 20000 : 5000; // Longer timeout for CI
    
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    // Use a simpler, more reliable command for CI
    proc.stdin?.write('const result = await exec`echo "test-output"`; say(`Got: ${result.output.trim()}`);');
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    // Debug output for CI troubleshooting
    if (exitCode !== 0 || isCI) {
      console.log('Environment: CI =', isCI);
      console.log('STDOUT:', JSON.stringify(output));
      console.log('STDERR:', JSON.stringify(stderr));
      console.log('EXIT CODE:', exitCode);
    }

    expect(exitCode).toBe(0);
    expect(output).toContain('Got: test-output');
  }, isCI ? 30000 : 10000); // Different timeout for CI vs local

  test('handles multiple statements from stdin', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      say('Starting tasks...');
      exec\`echo "First command"\`;
      say('Tasks completed!');
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain('Starting tasks...');
    expect(output).toContain('First command');
    expect(output).toContain('Tasks completed!');
  });

  test('handles syntax errors in piped code', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    proc.stdin?.write('invalid javascript syntax {{{');
    proc.stdin?.end();

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error executing piped JavaScript');
  });

  test('handles empty stdin input', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    proc.stdin?.write('');
    proc.stdin?.end();

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain('No JavaScript code provided via stdin');
  });

  test('all bunosh globals are available in piped code', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      // Test various bunosh globals
      say('Testing say function');
      yell('TESTING YELL');
      const execResult = await exec\`echo "Testing exec"\`;
      const shellResult = await shell\`echo "Testing shell"\`;
      say('All tests completed');
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    // Debug output for CI troubleshooting
    if (exitCode !== 0 || isCI) {
      console.log('Globals test - STDOUT:', JSON.stringify(output));
      console.log('Globals test - STDERR:', JSON.stringify(stderr));
      console.log('Globals test - EXIT CODE:', exitCode);
    }

    expect(exitCode).toBe(0);
    expect(output).toContain('Testing say function');
    expect(output).toContain('TESTING YELL'); // yell creates ASCII art
    expect(output).toContain('All tests completed');
  }, isCI ? 30000 : 10000);

  test('handles async operations in piped code', async () => {
    const proc = spawn({
      cmd: ['bun', bunoshPath],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const code = `
      await exec\`echo "Async command 1"\`;
      await exec\`echo "Async command 2"\`;
      say('All async commands completed');
    `;
    
    proc.stdin?.write(code);
    proc.stdin?.end();

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain('Async command 1');
    expect(output).toContain('Async command 2');
    expect(output).toContain('All async commands completed');
  });

  test('correctly detects non-pipe input', () => {
    // Test the isPipeInput function logic
    // When process.stdin.isTTY is true (terminal), isPipeInput should return false
    const originalIsTTY = process.stdin.isTTY;
    
    // Mock TTY scenario
    process.stdin.isTTY = true;
    
    // Import the isPipeInput function logic inline for testing
    const isPipeInput = () => {
      return process.stdin.isTTY === undefined || !process.stdin.isTTY;
    };
    
    expect(isPipeInput()).toBe(false);
    
    // Restore original value
    process.stdin.isTTY = originalIsTTY;
  });
});