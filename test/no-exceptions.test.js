import { describe, test, expect, mock, spyOn } from 'bun:test';
import { task } from '../src/task.js';
import execFunction from '../src/tasks/exec.js';
import shellFunction from '../src/tasks/shell.js';

// Mock console.log for cleaner test output
const mockConsoleLog = mock(() => {});

describe('No Exceptions Policy', () => {
  test('task() does not throw exceptions on failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // This should not throw an exception
    const result = await task('failing task', () => {
      throw new Error('task failed');
    });
    
    expect(result.hasFailed).toBe(true);
    expect(result.output).toBe('task failed');
    
    console.log.mockRestore();
  });

  test('exec`` does not throw exceptions on command failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // This should not throw an exception even though the command fails
    const result = await execFunction`exit 1`;
    
    expect(result.hasFailed).toBe(true);
    expect(result.hasSucceeded).toBe(false);
    
    console.log.mockRestore();
  });

  test('shell`` does not throw exceptions on command failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // This should not throw an exception even though the command fails
    const result = await shellFunction`exit 1`;
    
    expect(result.hasFailed).toBe(true);
    expect(result.hasSucceeded).toBe(false);
    
    console.log.mockRestore();
  });

  test('multiple failing operations can be handled without try/catch', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // All these operations can be done without try/catch blocks
    const taskResult = await task('failing task', () => {
      throw new Error('task error');
    });
    
    const execResult = await execFunction`exit 2`;
    
    const shellResult = await shellFunction`exit 3`;
    
    // Verify all failed but didn't throw
    expect(taskResult.hasFailed).toBe(true);
    expect(execResult.hasFailed).toBe(true);
    expect(shellResult.hasFailed).toBe(true);
    
    // Verify error details are available
    expect(taskResult.output).toBe('task error');
    
    console.log.mockRestore();
  });

  test('successful operations still work without try/catch', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const taskResult = await task('success task', () => {
      return 'success';
    });
    
    const execResult = await execFunction`echo "test"`;
    
    const shellResult = await shellFunction`echo "shell test"`;
    
    // Verify all succeeded
    expect(taskResult.hasSucceeded).toBe(true);
    expect(execResult.hasSucceeded).toBe(true);
    expect(shellResult.hasSucceeded).toBe(true);
    
    // Verify outputs
    expect(taskResult.output).toBe('success');
    expect(execResult.output).toContain('test');
    expect(shellResult.output).toContain('shell test');
    
    console.log.mockRestore();
  });
});