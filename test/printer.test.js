import { describe, test, expect, mock, spyOn } from 'bun:test';
import { Printer } from '../src/printer.js';

// Mock console.log to capture output
const mockConsoleLog = mock(() => {});

describe('Printer', () => {
  test('creates printer with task type', () => {
    const printer = new Printer('test');
    expect(printer.taskType).toBe('test');
  });

  test('start method sets startTime and schedules delayed print', () => {
    const printer = new Printer('test');
    printer.start('test task');
    
    expect(typeof printer.startTime).toBe('number');
    expect(printer.startTimeout).toBeDefined();
  });

  test('finish method cancels delayed start and prints result', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const printer = new Printer('test');
    printer.start('test task');
    printer.finish('test task');
    
    expect(printer.startTimeout).toBeNull();
    expect(mockConsoleLog).toHaveBeenCalled();
    
    console.log.mockRestore();
  });

  test('error method cancels delayed start and prints error', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const printer = new Printer('test');
    printer.start('test task');
    printer.error('test task', new Error('test error'));
    
    expect(printer.startTimeout).toBeNull();
    expect(mockConsoleLog).toHaveBeenCalled();
    
    console.log.mockRestore();
  });

  test('output method prints formatted line', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);

    const printer = new Printer('test');
    printer.output('test output');

    expect(mockConsoleLog).toHaveBeenCalledWith('   test output');

    console.log.mockRestore();
  });

  test('output method skips empty lines', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    mockConsoleLog.mockClear(); // Clear any previous calls
    
    const printer = new Printer('test');
    printer.output('   '); // Empty/whitespace-only line
    
    expect(mockConsoleLog).not.toHaveBeenCalled();
    
    console.log.mockRestore();
  });

  test('info method prints info status', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    const printer = new Printer('test');
    printer.info('info message');
    
    expect(mockConsoleLog).toHaveBeenCalled();
    
    console.log.mockRestore();
  });

  test('static log method creates printer and prints', () => {
    spyOn(console, 'log').mockImplementation(mockConsoleLog);
    
    Printer.log('test task', 'start');
    
    expect(mockConsoleLog).toHaveBeenCalled();
    
    console.log.mockRestore();
  });
});