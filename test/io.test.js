import { describe, test, expect, mock, spyOn } from 'bun:test';
import { say, yell } from '../src/io.js';

describe('IO Functions', () => {
  test('say function outputs message with exclamation', () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    say('test message');
    
    expect(mockConsoleLog).toHaveBeenCalledWith('!', 'test message');
    
    mockConsoleLog.mockRestore();
  });

  test('say function handles multiple arguments', () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    say('arg1', 'arg2', 'arg3');
    
    expect(mockConsoleLog).toHaveBeenCalledWith('!', 'arg1', 'arg2', 'arg3');
    
    mockConsoleLog.mockRestore();
  });

  test('yell function outputs uppercase with cfonts formatting', () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    yell('test message');
    
    // cfonts.say() outputs formatted text, so we should have some console.log calls
    expect(mockConsoleLog).toHaveBeenCalled();
    
    // Since cfonts outputs ASCII art, we can't easily predict the exact output,
    // but we can verify that console.log was called at least once
    expect(mockConsoleLog.mock.calls.length).toBeGreaterThan(0);
    
    mockConsoleLog.mockRestore();
  });

  // Note: ask function is not easily testable in automated tests since it requires
  // user input via inquirer. It would need more complex mocking of the inquirer module.
});