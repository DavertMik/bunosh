import { describe, test, expect } from 'bun:test';
import { TaskResult, TaskStatus } from '../src/task.js';

describe('TaskResult.json() method', () => {
  test('should handle fetch tasks with JSON response', async () => {
    const mockResponse = {
      json: async () => ({ message: 'Hello, World!', status: 'success' })
    };
    
    const metadata = {
      taskType: 'fetch',
      response: mockResponse,
      status: 200,
      statusText: 'OK'
    };
    
    const result = TaskResult.success('{"message":"Hello, World!","status":"success"}', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ message: 'Hello, World!', status: 'success' });
  });

  test('should handle fetch tasks with string output when no response object', async () => {
    const metadata = {
      taskType: 'fetch',
      status: 200,
      statusText: 'OK'
    };
    
    const result = TaskResult.success('{"data":{"id":1,"name":"test"}}', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ data: { id: 1, name: 'test' } });
  });

  test('should throw error for invalid JSON in fetch tasks', async () => {
    const metadata = {
      taskType: 'fetch',
      status: 200,
      statusText: 'OK'
    };
    
    const result = TaskResult.success('invalid json', metadata);
    
    await expect(result.json()).rejects.toThrow('Failed to parse fetch output as JSON');
  });

  test('should handle exec tasks with structured output', async () => {
    const metadata = {
      taskType: 'exec',
      exitCode: 0,
      stdout: 'Hello\nWorld',
      stderr: ''
    };
    
    const result = TaskResult.success('Hello\nWorld', metadata);
    const json = await result.json();
    
    expect(json).toEqual({
      stdout: 'Hello\nWorld',
      stderr: '',
      exitCode: 0,
      lines: ['Hello', 'World']
    });
  });

  test('should handle failed exec tasks with exit code', async () => {
    const metadata = {
      taskType: 'exec',
      exitCode: 1,
      stdout: 'Some output',
      stderr: 'Error occurred'
    };
    
    const result = TaskResult.fail('Some output\nError occurred', metadata);
    const json = await result.json();
    
    expect(json).toEqual({
      stdout: 'Some output',
      stderr: 'Error occurred',
      exitCode: 1,
      lines: ['Some output', 'Error occurred']
    });
  });

  test('should handle shell tasks with structured output', async () => {
    const metadata = {
      taskType: 'shell',
      exitCode: 0,
      stdout: 'ls output',
      stderr: ''
    };
    
    const result = TaskResult.success('ls output', metadata);
    const json = await result.json();
    
    expect(json).toEqual({
      stdout: 'ls output',
      stderr: '',
      exitCode: 0,
      lines: ['ls output']
    });
  });

  test('should handle AI tasks with structured output', async () => {
    const aiOutput = {
      title: 'Generated Title',
      content: 'Generated content here'
    };
    
    const metadata = {
      taskType: 'ai',
      outputFormat: true,
      usage: { totalTokens: 150 }
    };
    
    const result = TaskResult.success(aiOutput, metadata);
    const json = await result.json();
    
    expect(json).toEqual(aiOutput);
  });

  test('should handle AI tasks with text output', async () => {
    const metadata = {
      taskType: 'ai',
      outputFormat: false,
      usage: { totalTokens: 100 }
    };
    
    const result = TaskResult.success('This is generated text', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ text: 'This is generated text' });
  });

  test('should handle AI tasks with JSON string output', async () => {
    const metadata = {
      taskType: 'ai',
      outputFormat: false,
      usage: { totalTokens: 120 }
    };
    
    const result = TaskResult.success('{"answer": "42", "question": "life"}', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ answer: '42', question: 'life' });
  });

  test('should handle unknown task types by parsing JSON', async () => {
    const metadata = {
      taskType: 'unknown'
    };
    
    const result = TaskResult.success('{"custom": "data"}', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ custom: 'data' });
  });

  test('should handle unknown task types with non-JSON output', async () => {
    const metadata = {
      taskType: 'unknown'
    };
    
    const result = TaskResult.success('plain text output', metadata);
    const json = await result.json();
    
    expect(json).toEqual({ text: 'plain text output' });
  });

  test('should handle tasks with object output', async () => {
    const objectOutput = { key: 'value', number: 42 };
    const metadata = {
      taskType: 'custom'
    };
    
    const result = TaskResult.success(objectOutput, metadata);
    const json = await result.json();
    
    expect(json).toEqual(objectOutput);
  });

  test('should handle empty or null output', async () => {
    const metadata = {
      taskType: 'exec',
      exitCode: 0,
      stdout: '',
      stderr: ''
    };
    
    const result = TaskResult.success('', metadata);
    const json = await result.json();
    
    expect(json).toEqual({
      stdout: '',
      stderr: '',
      exitCode: 0,
      lines: []
    });
  });

  test('should handle exec tasks without metadata', async () => {
    const result = TaskResult.success('output without metadata', {});
    const json = await result.json();
    
    expect(json).toEqual({ text: 'output without metadata' });
  });
});