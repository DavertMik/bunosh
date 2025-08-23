import { describe, test, expect, spyOn } from 'bun:test';
import { task, getTaskPrefix, createTaskInfo, finishTaskInfo, runningTasks } from '../src/task.js';
import { exec } from '../index.js';
import chalk from 'chalk';

describe('Task Prefix Styling', () => {
  test('task prefix uses angle brackets format ❰n❱', () => {
    const taskInfo1 = createTaskInfo('task1');
    const taskInfo2 = createTaskInfo('task2');
    
    // Should have angle bracket format
    const prefix1 = getTaskPrefix(taskInfo1.id);
    const prefix2 = getTaskPrefix(taskInfo2.id);
    
    expect(prefix1).toBe('❰1❱');
    expect(prefix2).toBe('❰2❱');
    
    // Clean up
    finishTaskInfo(taskInfo1, true);
    finishTaskInfo(taskInfo2, true);
  });

  test('single task has no prefix', () => {
    const taskInfo = createTaskInfo('single task');
    
    const prefix = getTaskPrefix(taskInfo.id);
    expect(prefix).toBe('');
    
    finishTaskInfo(taskInfo, true);
  });

  test('parallel tasks show angle bracket prefixes in output', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    const tasks = [
      task('styled-task-1', async () => {
        await exec`echo "output from styled task 1"`;
      }),
      task('styled-task-2', async () => {
        await exec`echo "output from styled task 2"`;
      }),
      task('styled-task-3', async () => {
        await exec`echo "output from styled task 3"`;
      })
    ];
    
    await Promise.all(tasks);
    
    // Check that messages contain the new angle bracket format
    const prefixedMessages = loggedMessages.filter(msg => /❰\d+❱/.test(msg));
    expect(prefixedMessages.length).toBeGreaterThan(0);
    
    // Should have angle bracket prefixes for parallel tasks
    const hasTask1Prefix = loggedMessages.some(msg => msg.includes('❰1❱ styled-task-1') || msg.includes('❰2❱ styled-task-1') || msg.includes('❰3❱ styled-task-1'));
    const hasTask2Prefix = loggedMessages.some(msg => msg.includes('❰1❱ styled-task-2') || msg.includes('❰2❱ styled-task-2') || msg.includes('❰3❱ styled-task-2'));
    const hasTask3Prefix = loggedMessages.some(msg => msg.includes('❰1❱ styled-task-3') || msg.includes('❰2❱ styled-task-3') || msg.includes('❰3❱ styled-task-3'));
    
    // At least one task should have gotten a prefix during parallel execution
    expect(hasTask1Prefix || hasTask2Prefix || hasTask3Prefix).toBe(true);
    
    mockConsoleLog.mockRestore();
  });

  test('output lines have dimmed gray prefixes in parallel execution', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    const tasks = [
      exec`echo "line output 1"`,
      exec`echo "line output 2"`
    ];
    
    await Promise.all(tasks);
    
    // Check that output lines contain gray dimmed prefixes
    // The actual output will have ANSI color codes from chalk.gray.dim()
    const outputLines = loggedMessages.filter(msg => 
      msg.includes('line output') && msg.includes('❰')
    );
    
    expect(outputLines.length).toBeGreaterThan(0);
    
    // Verify that at least some lines have the dimmed prefix format
    // Note: chalk.gray.dim() will add ANSI escape codes, so we check for the presence of the prefix chars
    const hasDimmedPrefixes = outputLines.some(msg => /❰\d+❱/.test(msg));
    expect(hasDimmedPrefixes).toBe(true);
    
    mockConsoleLog.mockRestore();
  });

  test('simple single exec task shows no prefix', async () => {
    const loggedMessages = [];
    const mockConsoleLog = spyOn(console, 'log').mockImplementation((...args) => {
      loggedMessages.push(args.join(' '));
    });
    
    // Run a single exec command (not wrapped in task())
    await exec`echo "single exec output"`;
    
    // Single exec should not have prefixes
    const prefixedMessages = loggedMessages.filter(msg => /❰\d+❱/.test(msg));
    expect(prefixedMessages.length).toBe(0);
    
    // Should have at least one message with the output
    const outputMessages = loggedMessages.filter(msg => msg.includes('single exec output'));
    expect(outputMessages.length).toBeGreaterThan(0);
    
    mockConsoleLog.mockRestore();
  });

  test('prefix numbering consistency with angle brackets', () => {
    const taskInfos = [];
    
    // Create 5 concurrent tasks
    for (let i = 0; i < 5; i++) {
      taskInfos.push(createTaskInfo(`task-${i}`));
    }
    
    // Get prefixes for all tasks
    const prefixes = taskInfos.map(ti => getTaskPrefix(ti.id));
    
    // Should have unique numbered angle bracket prefixes
    expect(prefixes).toEqual(['❰1❱', '❰2❱', '❰3❱', '❰4❱', '❰5❱']);
    
    // Clean up
    taskInfos.forEach(ti => finishTaskInfo(ti, true));
  });
});