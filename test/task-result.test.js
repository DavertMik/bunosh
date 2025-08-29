import { describe, test, expect } from 'bun:test';
import { TaskResult, TaskStatus } from '../src/task.js';

describe('TaskResult', () => {
  test('creates success result correctly', () => {
    const result = TaskResult.success('Command output');
    
    expect(result.status).toBe(TaskStatus.SUCCESS);
    expect(result.output).toBe('Command output');
    expect(result.hasSucceeded).toBe(true);
    expect(result.hasFailed).toBe(false);
  });

  test('creates failure result correctly', () => {
    const result = TaskResult.fail('Error output');
    
    expect(result.status).toBe(TaskStatus.FAIL);
    expect(result.output).toBe('Error output');
    expect(result.hasSucceeded).toBe(false);
    expect(result.hasFailed).toBe(true);
  });

  test('creates success result with no output', () => {
    const result = TaskResult.success();
    
    expect(result.status).toBe(TaskStatus.SUCCESS);
    expect(result.output).toBe(null);
    expect(result.hasSucceeded).toBe(true);
    expect(result.hasFailed).toBe(false);
  });

  test('creates failure result with no output', () => {
    const result = TaskResult.fail();
    
    expect(result.status).toBe(TaskStatus.FAIL);
    expect(result.output).toBe(null);
    expect(result.hasSucceeded).toBe(false);
    expect(result.hasFailed).toBe(true);
  });

  test('constructor creates result correctly', () => {
    const successResult = new TaskResult({
      status: TaskStatus.SUCCESS,
      output: 'Success output'
    });
    
    expect(successResult.status).toBe(TaskStatus.SUCCESS);
    expect(successResult.output).toBe('Success output');
    expect(successResult.hasSucceeded).toBe(true);
    expect(successResult.hasFailed).toBe(false);

    const failResult = new TaskResult({
      status: TaskStatus.FAIL, 
      output: 'Fail output'
    });
    
    expect(failResult.status).toBe(TaskStatus.FAIL);
    expect(failResult.output).toBe('Fail output');
    expect(failResult.hasSucceeded).toBe(false);
    expect(failResult.hasFailed).toBe(true);
  });

  test('getters are read-only properties', () => {
    const result = TaskResult.success('test');
    
    // Try to set the getter (should throw or be ignored)
    expect(() => {
      result.hasFailed = true;
    }).toThrow();
    
    expect(() => {
      result.hasSucceeded = false;  
    }).toThrow();
    
    // Original values should remain unchanged
    expect(result.hasSucceeded).toBe(true);
    expect(result.hasFailed).toBe(false);
  });
});