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

  test('yell function outputs uppercase with formatting', () => {
    const mockConsoleLog = spyOn(console, 'log').mockImplementation(() => {});
    
    yell('test message');
    
    // Should call console.log 3 times (empty line, message, empty line)
    expect(mockConsoleLog).toHaveBeenCalledTimes(3);
    
    // Check that the middle call contains the uppercase message
    const calls = mockConsoleLog.mock.calls;
    expect(calls[0].length).toBe(0); // First empty line (no arguments)
    expect(calls[1][0]).toContain('TEST MESSAGE'); // Uppercase message
    expect(calls[2].length).toBe(0); // Last empty line (no arguments)
    
    mockConsoleLog.mockRestore();
  });

  // Note: ask function is not easily testable in automated tests since it requires
  // user input via inquirer. It would need more complex mocking of the inquirer module.
});