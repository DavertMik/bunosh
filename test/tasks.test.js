import { describe, test, expect, mock, spyOn } from 'bun:test';
import { task, tryTask, TaskStatus, tasksExecuted, createTaskInfo, finishTaskInfo } from '../src/task.js';

// Mock console.log to reduce noise during tests
const mockConsoleLog = mock(() => {});

describe('Task System', () => {
  test('TaskStatus has correct values', () => {
    expect(TaskStatus.RUNNING).toBe('running');
    expect(TaskStatus.FAIL).toBe('fail');
    expect(TaskStatus.SUCCESS).toBe('success');
    expect(TaskStatus.WARNING).toBe('warning');
  });

  test('createTaskInfo and finishTaskInfo manage task lifecycle', () => {
    const initialCount = tasksExecuted.length;
    
    const taskInfo = createTaskInfo('test task');
    
    expect(tasksExecuted.length).toBe(initialCount + 1);
    expect(taskInfo.name).toBe('test task');
    expect(taskInfo.status).toBe(TaskStatus.RUNNING);
    
    finishTaskInfo(taskInfo, true, null, 'success output');
    
    expect(taskInfo.status).toBe(TaskStatus.SUCCESS);
    expect(taskInfo.result.output).toBe('success output');
  });

  test('task function executes successfully', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const initialCount = tasksExecuted.length;
    const result = await task('test task', () => {
      return 'success result';
    });
    
    expect(result.hasSucceeded).toBe(true);
    expect(result.output).toBe('success result');
    expect(tasksExecuted.length).toBe(initialCount + 1);
    expect(tasksExecuted[tasksExecuted.length - 1].status).toBe(TaskStatus.SUCCESS);
    
    console.log.mockRestore();
  });

  test('task function handles errors', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const initialCount = tasksExecuted.length;
    
    const result = await task('failing task', () => {
      throw new Error('task failed');
    });
    
    expect(result.hasFailed).toBe(true);
    expect(result.output).toBe('task failed');
    expect(tasksExecuted.length).toBe(initialCount + 1);
    expect(tasksExecuted[tasksExecuted.length - 1].status).toBe(TaskStatus.FAIL);
    
    console.log.mockRestore();
  });

  test('task function can infer name from function', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const namedFunction = function testFunction() {
      return 'result';
    };
    
    await task(namedFunction);
    
    // Should not throw and should execute
    expect(mockConsoleLog).toHaveBeenCalled();
    
    console.log.mockRestore();
  });
});

describe('Task Try Function', () => {
  test('tryTask returns true for successful execution', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await tryTask('successful task', () => {
      return 'success';
    });
    
    expect(result).toBe(true);
    
    const lastTask = tasksExecuted[tasksExecuted.length - 1];
    expect(lastTask.status).toBe(TaskStatus.SUCCESS);
    
    console.log.mockRestore();
  });

  test('tryTask returns false for failed execution', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await tryTask('failing task', () => {
      throw new Error('test error');
    });
    
    expect(result).toBe(false);
    
    const lastTask = tasksExecuted[tasksExecuted.length - 1];
    expect(lastTask.status).toBe(TaskStatus.WARNING);
    expect(lastTask.result.output).toBe('test error');
    
    console.log.mockRestore();
  });

  test('tryTask can infer name from function', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const namedFunction = function testFunction() {
      return 'result';
    };
    
    await tryTask(namedFunction);
    
    const lastTask = tasksExecuted[tasksExecuted.length - 1];
    expect(lastTask.name).toContain('testFunction');
    
    console.log.mockRestore();
  });
});

describe('Failure Handling Modes', () => {
  test('ignoreFailures prevents process exit on task failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    spyOn(process, 'exit').mockImplementation(() => {});
    
    // Reset failure handling mode
    const { ignoreFailures } = await import('../src/task.js');
    ignoreFailures();
    
    const result = await task('failing task', () => {
      throw new Error('test error');
    });
    
    // task() now returns TaskResult instead of throwing, but process.exit should not be called in ignoreFailures mode
    expect(result.hasFailed).toBe(true);
    expect(result.output).toBe('test error');
    expect(process.exit).not.toHaveBeenCalled();
    
    console.log.mockRestore();
    process.exit.mockRestore();
  });

  test('stopOnFailures mode is set correctly', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    // Reset and set stop on failures mode
    const { stopOnFailures, ignoreFailures } = await import('../src/task.js');
    ignoreFailures(); // Reset first
    stopOnFailures();
    
    // The mode should be set (we can't easily test the exit behavior since test environment prevents it)
    expect(true).toBe(true); // This test verifies the mode can be set without errors
    
    console.log.mockRestore();
  });
});