import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from 'bun:test';
import execFunction from '../src/tasks/exec.js';

// Mock console.log to reduce noise
const mockConsoleLog = mock(() => {});

describe('Node.js Fallback Execution', () => {
  beforeEach(() => {
    // Enable Node.js fallback mode for testing
    global.disableBunForTesting = true;
  });

  afterEach(() => {
    // Restore normal Bun mode
    delete global.disableBunForTesting;
  });

  test('nodeExec executes simple commands successfully', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`echo "nodejs fallback test"`;
    
    expect(result.status).toBe('success');
    expect(result.output).toContain('nodejs fallback test');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec handles command failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`false`; // Command that always fails
    
    expect(result.status).toBe('fail');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec works with shell commands', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`echo "hello" | wc -l`;
    
    expect(result.status).toBe('success');
    expect(result.output.trim()).toBe('1');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec handles stderr output', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`sh -c 'echo "error message" >&2; exit 1'`;
    
    expect(result.status).toBe('fail');
    expect(result.output).toContain('error message');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec with environment variables (needs implementation)', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // TODO: Environment variables not yet implemented in nodeExec
    const result = await execFunction`echo "env vars test"`.env({ TEST_NODE_VAR: 'node_test_value' });
    
    expect(result.status).toBe('success');
    expect(result.output).toContain('env vars test');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec with working directory change (needs implementation)', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // TODO: Working directory change not yet implemented in nodeExec
    const result = await execFunction`echo "cwd test"`.cwd('/tmp');
    
    expect(result.status).toBe('success');
    expect(result.output).toContain('cwd test');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec handles complex shell commands', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`echo -e "line1\nline2\nline3" | grep "line2"`;
    
    expect(result.status).toBe('success');
    expect(result.output.trim()).toBe('line2');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec with both stdout and stderr', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`sh -c 'echo "stdout message"; echo "stderr message" >&2; exit 0'`;
    
    expect(result.status).toBe('success');
    expect(result.output).toContain('stdout message');
    expect(result.output).toContain('stderr message');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec execution mode comparison', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // Test Node.js mode
    global.disableBunForTesting = true;
    const nodeResult = await execFunction`echo "nodejs execution"`;
    
    // Test Bun mode
    delete global.disableBunForTesting;
    const bunResult = await execFunction`echo "bun execution"`;
    
    // Both should succeed but might have different execution paths
    expect(nodeResult.status).toBe('success');
    expect(bunResult.status).toBe('success');
    expect(nodeResult.output).toContain('nodejs execution');
    expect(bunResult.output).toContain('bun execution');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec handles command timeout gracefully', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // Quick command that should complete well within timeout
    const result = await execFunction`sleep 0.1 && echo "timeout test"`;
    
    expect(result.status).toBe('success');
    expect(result.output).toContain('timeout test');
    
    console.log.mockRestore();
  }, 5000);

  test('nodeExec maintains task registration', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const { tasksExecuted } = await import('../src/task.js');
    const initialCount = tasksExecuted.length;
    
    await execFunction`echo "task registration test"`;
    
    expect(tasksExecuted.length).toBe(initialCount + 1);
    expect(tasksExecuted[tasksExecuted.length - 1].name).toContain('task registration test');
    
    console.log.mockRestore();
  }, 5000);
});

describe('Runtime Detection and Switching', () => {
  test('exec function detects disableBunForTesting flag', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // Test with flag enabled
    global.disableBunForTesting = true;
    const nodeResult = await execFunction`echo "detection test node"`;
    
    // Test with flag disabled  
    delete global.disableBunForTesting;
    const bunResult = await execFunction`echo "detection test bun"`;
    
    // Both should work but use different execution paths
    expect(nodeResult.status).toBe('success');
    expect(bunResult.status).toBe('success');
    
    console.log.mockRestore();
  }, 5000);

  test('runtime switching preserves task counting', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const { tasksExecuted } = await import('../src/task.js');
    const initialCount = tasksExecuted.length;
    
    // Execute with Node.js mode
    global.disableBunForTesting = true;
    await execFunction`echo "node mode"`;
    
    // Execute with Bun mode
    delete global.disableBunForTesting;
    await execFunction`echo "bun mode"`;
    
    expect(tasksExecuted.length).toBe(initialCount + 2);
    
    console.log.mockRestore();
  }, 5000);
});