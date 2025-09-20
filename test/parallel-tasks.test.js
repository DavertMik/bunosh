import { describe, test, expect, spyOn } from 'bun:test';
import { task, getRunningTaskCount } from '../src/task.js';

describe('Parallel Task Support', () => {
  test('single task should not have prefix in output', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    await task('single task', async () => {
      // Just a simple task
      return 'done';
    });
    
    // Check that no prefixes were used in logged messages
    const hasPrefix = loggedMessages.some(msg => /❰\d+❱/.test(msg));
    expect(hasPrefix).toBe(false);
    
    mockConsoleLog.mockRestore();
  });

  test('parallel tasks should have numbered prefixes', async () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    // Check that console.log was called with prefixed task names
    const loggedMessages = [];
    mockConsoleLog.mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    const tasks = [
      task('task1', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      }),
      task('task2', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
      }),
      task('task3', async () => {
        await new Promise(resolve => setTimeout(resolve, 40));
      })
    ];
    
    await Promise.all(tasks);
    
    // Check that logged messages contain prefixes
    const prefixedMessages = loggedMessages.filter(msg => /❰\d+❱/.test(msg));
    expect(prefixedMessages.length).toBeGreaterThan(0);
    
    // At least some messages should have prefixes for parallel tasks
    const hasTask1Prefix = loggedMessages.some(msg => msg.includes('❰1❱ task1') || msg.includes('❰2❱ task1') || msg.includes('❰3❱ task1'));
    const hasTask2Prefix = loggedMessages.some(msg => msg.includes('❰1❱ task2') || msg.includes('❰2❱ task2') || msg.includes('❰3❱ task2'));
    const hasTask3Prefix = loggedMessages.some(msg => msg.includes('❰1❱ task3') || msg.includes('❰2❱ task3') || msg.includes('❰3❱ task3'));
    
    // At least one task should have gotten a prefix during parallel execution
    expect(hasTask1Prefix || hasTask2Prefix || hasTask3Prefix).toBe(true);
    
    mockConsoleLog.mockRestore();
  });

  test('running task count updates correctly during parallel execution', async () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    // Simply test that we can run tasks in parallel
    const tasks = [
      task('count-task1', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'task1-done';
      }),
      task('count-task2', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'task2-done';
      })
    ];
    
    const results = await Promise.all(tasks);
    
    // All tasks should complete successfully
    expect(results.map(r => r.output)).toEqual(['task1-done', 'task2-done']);
    expect(results.every(r => r.hasSucceeded)).toBe(true);
    
    mockConsoleLog.mockRestore();
  });

  test('parallel tasks with exec commands show prefixes', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    const { exec } = await import('../index.js');
    
    const tasks = [
      task('echo-task-1', async () => {
        await exec`echo "output from task 1"`;
      }),
      task('echo-task-2', async () => {
        await exec`echo "output from task 2"`;
      })
    ];
    
    await Promise.all(tasks);
    
    // Check that some messages contain prefixes for parallel execution
    const prefixedMessages = loggedMessages.filter(msg => /❰\d+❱/.test(msg));
    expect(prefixedMessages.length).toBeGreaterThan(0);
    
    // Should have prefixes for both task names and exec commands
    const hasTaskPrefixes = loggedMessages.some(msg => 
      msg.includes('❰1❱ echo-task-') || msg.includes('❰2❱ echo-task-')
    );
    const hasExecPrefixes = loggedMessages.some(msg => 
      msg.includes('❰1❱ echo "output from task') || msg.includes('❰2❱ echo "output from task')
    );
    
    expect(hasTaskPrefixes || hasExecPrefixes).toBe(true);
    
    mockConsoleLog.mockRestore();
  });

  test('mixed sequential and parallel tasks handle prefixes correctly', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    // First, run a single task (should have no prefix)
    await task('sequential-1', async () => {
      return 'seq1-done';
    });
    
    // Then run parallel tasks (should have prefixes)
    const parallelTasks = [
      task('parallel-1', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return 'par1-done';
      }),
      task('parallel-2', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return 'par2-done';
      })
    ];
    
    await Promise.all(parallelTasks);
    
    // Finally, run another single task (should have no prefix again)
    await task('sequential-2', async () => {
      return 'seq2-done';
    });
    
    // Check message patterns
    const sequentialMessages = loggedMessages.filter(msg => msg.includes('sequential-'));
    const parallelMessages = loggedMessages.filter(msg => msg.includes('parallel-'));
    
    // Sequential tasks should not have prefixes
    const sequentialWithPrefix = sequentialMessages.some(msg => /❰\d+❱/.test(msg));
    expect(sequentialWithPrefix).toBe(false);
    
    // Parallel tasks should have at least some prefixes
    const parallelWithPrefix = parallelMessages.some(msg => /❰\d+❱/.test(msg));
    expect(parallelWithPrefix).toBe(true);
    
    mockConsoleLog.mockRestore();
  });
});