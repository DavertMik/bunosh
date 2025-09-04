import { describe, test, expect, mock, spyOn } from 'bun/test';
import { task, tryTask, TaskStatus, tasksExecuted, createTaskInfo, finishTaskInfo } from '../src/task.js';
import execFunction from '../src/tasks/exec.js';
import fetchFunction from '../src/tasks/fetch.js';
import writeToFileFunction from '../src/tasks/writeToFile.js';
import copyFileFunction from '../src/tasks/copyFile.js';

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

  test('finishTaskInfo handles failure', () => {
    const taskInfo = createTaskInfo('failed task');
    const error = new Error('test error');
    
    finishTaskInfo(taskInfo, false, error, 'error output');
    
    expect(taskInfo.status).toBe(TaskStatus.FAIL);
    expect(taskInfo.result.output).toBe('test error');
  });

  test('task function executes successfully', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const initialCount = tasksExecuted.length;
    const result = await task('test task', () => {
      return 'success result';
    });
    
    expect(result).toBe('success result');
    expect(tasksExecuted.length).toBe(initialCount + 1);
    expect(tasksExecuted[tasksExecuted.length - 1].status).toBe(TaskStatus.SUCCESS);
    
    console.log.mockRestore();
  });

  test('task function handles errors', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const initialCount = tasksExecuted.length;
    
    try {
      await task('failing task', () => {
        throw new Error('task failed');
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error.message).toBe('task failed');
      expect(tasksExecuted.length).toBe(initialCount + 1);
      expect(tasksExecuted[tasksExecuted.length - 1].status).toBe(TaskStatus.FAIL);
    }
    
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

describe('Exec Task', () => {
  test('exec function returns promise with methods', () => {
    const execPromise = execFunction`echo test`;
    
    expect(execPromise).toBeInstanceOf(Promise);
    expect(typeof execPromise.env).toBe('function');
    expect(typeof execPromise.cwd).toBe('function');
  });

  test('exec env method returns same promise', () => {
    const execPromise = execFunction`echo test`;
    const result = execPromise.env({ TEST: 'value' });
    
    expect(result).toBe(execPromise);
  });

  test('exec cwd method returns same promise', () => {
    const execPromise = execFunction`echo test`;
    const result = execPromise.cwd('/tmp');
    
    expect(result).toBe(execPromise);
  });

  // Integration test for successful command
  test('exec executes simple command successfully', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`echo "hello test"`;
    
    expect(result.status).toBe(TaskStatus.SUCCESS);
    expect(result.output).toContain('hello test');
    
    console.log.mockRestore();
  }, 5000); // 5 second timeout for command execution

  // Test for command that should fail
  test('exec handles command failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const result = await execFunction`false`; // Command that always fails
    
    expect(result.status).toBe(TaskStatus.FAIL);
    
    console.log.mockRestore();
  }, 5000);
});

describe('WriteToFile Task', () => {
  test('writeToFile function creates file with string content', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const testFile = `/tmp/bunosh-test-${Date.now()}.txt`;
    const result = writeToFileFunction(testFile, 'test content');
    
    expect(result).toBe('test content');
    expect(Bun.file(testFile).text()).resolves.toBe('test content');
    
    // Cleanup
    require('fs').unlinkSync(testFile);
    
    console.log.mockRestore();
  });

  test('writeToFile function works with builder function', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const testFile = `/tmp/bunosh-test-${Date.now()}.txt`;
    const result = writeToFileFunction(testFile, (line) => {
      line('first line');
      line('second line');
    });
    
    expect(result).toBe('first line\nsecond line\n');
    expect(Bun.file(testFile).text()).resolves.toBe('first line\nsecond line\n');
    
    // Cleanup
    require('fs').unlinkSync(testFile);
    
    console.log.mockRestore();
  });
});

describe('CopyFile Task', () => {
  test('copyFile function copies file successfully', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const sourceFile = `/tmp/bunosh-test-source-${Date.now()}.txt`;
    const destFile = `/tmp/bunosh-test-dest-${Date.now()}.txt`;
    
    // Create source file
    require('fs').writeFileSync(sourceFile, 'test content');
    
    // Copy file
    copyFileFunction(sourceFile, destFile);
    
    // Verify copy
    expect(require('fs').readFileSync(destFile, 'utf8')).toBe('test content');
    
    // Cleanup
    require('fs').unlinkSync(sourceFile);
    require('fs').unlinkSync(destFile);
    
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

  test('ignoreFailures allows task failures without exit', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    spyOn(process, 'exit').mockImplementation(() => {});
    
    // Reset failure handling mode
    const { ignoreFailures } = await import('../src/task.js');
    ignoreFailures();
    
    try {
      await task('failing task', () => {
        throw new Error('test error');
      });
      // Should reach here without exiting
      expect(true).toBe(true);
    } catch (error) {
      // task() should not throw
      expect(true).toBe(false);
    }
    
    expect(process.exit).not.toHaveBeenCalled();
    
    console.log.mockRestore();
    process.exit.mockRestore();
  });

  test('stopOnFailures exits immediately on task failure', async () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    spyOn(process, 'exit').mockImplementation(() => {});
    
    // Reset and set stop on failures mode
    const { stopOnFailures, ignoreFailures } = await import('../src/task.js');
    ignoreFailures(); // Reset first
    stopOnFailures();
    
    try {
      await task('failing task', () => {
        throw new Error('test error');
      });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      // task() should not throw even in stopOnFailures mode
      expect(true).toBe(false);
    }
    
    expect(process.exit).toHaveBeenCalledWith(1);
    
    console.log.mockRestore();
    process.exit.mockRestore();
  });
});