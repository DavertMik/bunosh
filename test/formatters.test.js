import { describe, test, expect } from 'bun:test';
import { ConsoleFormatter } from '../src/formatters/console.js';
import { GitHubActionsFormatter } from '../src/formatters/github-actions.js';
import { createFormatter } from '../src/formatters/factory.js';

describe('ConsoleFormatter', () => {
  const formatter = new ConsoleFormatter();

  test('formats start status', () => {
    const result = formatter.format('test command', 'start', 'exec');
    expect(result).toContain('▶');
    expect(result).toContain('exec');
    expect(result).toContain('test command');
  });

  test('formats finish status with duration', () => {
    const result = formatter.format('test command', 'finish', 'exec', { duration: 123 });
    expect(result).toContain('✓');
    expect(result).toContain('123ms');
  });

  test('formats error status', () => {
    const result = formatter.format('test command', 'error', 'exec', { error: 'Test error' });
    expect(result).toContain('✗');
    expect(result).toContain('Test error');
  });

  test('formatOutput handles error lines', () => {
    const result = formatter.formatOutput('error line', true);
    expect(result).toContain('error line');
  });

  test('formatOutput handles normal lines', () => {
    const result = formatter.formatOutput('normal line', false);
    expect(result).toBe('normal line');
  });

  test('static detect returns true for non-CI', () => {
    const oldCI = process.env.CI;
    delete process.env.CI;
    expect(ConsoleFormatter.detect()).toBe(true);
    if (oldCI) process.env.CI = oldCI;
  });
});

describe('GitHubActionsFormatter', () => {
  const formatter = new GitHubActionsFormatter();

  test('formats start status as group', () => {
    const result = formatter.format('test command', 'start', 'exec');
    expect(result).toBe('::group::[exec] test command');
  });

  test('formats finish status as notice', () => {
    const result = formatter.format('test command', 'finish', 'exec', { duration: 123 });
    expect(result).toContain('::endgroup::');
    expect(result).toContain('::notice::✅');
    expect(result).toContain('123ms');
  });

  test('formats error status', () => {
    const result = formatter.format('test command', 'error', 'exec', { error: 'Test error' });
    expect(result).toContain('::endgroup::');
    expect(result).toContain('::error::❌');
    expect(result).toContain('Test error');
  });

  test('formats output status', () => {
    const result = formatter.format('output line', 'output', 'exec');
    expect(result).toBe('output line');
  });

  test('formats info status as debug', () => {
    const result = formatter.format('debug info', 'info', 'exec');
    expect(result).toBe('::debug::debug info');
  });

  test('static detect returns true when GITHUB_ACTIONS is set', () => {
    const oldValue = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = 'true';
    expect(GitHubActionsFormatter.detect()).toBe(true);
    
    delete process.env.GITHUB_ACTIONS;
    expect(GitHubActionsFormatter.detect()).toBe(false);
    
    if (oldValue) process.env.GITHUB_ACTIONS = oldValue;
  });
});

describe('FormatterFactory', () => {
  test('creates GitHubActionsFormatter when GITHUB_ACTIONS is true', () => {
    const oldValue = process.env.GITHUB_ACTIONS;
    process.env.GITHUB_ACTIONS = 'true';
    
    const formatter = createFormatter();
    expect(formatter).toBeInstanceOf(GitHubActionsFormatter);
    
    if (oldValue) process.env.GITHUB_ACTIONS = oldValue;
    else delete process.env.GITHUB_ACTIONS;
  });

  test('creates ConsoleFormatter by default', () => {
    const oldValue = process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_ACTIONS;
    
    const formatter = createFormatter();
    expect(formatter).toBeInstanceOf(ConsoleFormatter);
    
    if (oldValue) process.env.GITHUB_ACTIONS = oldValue;
  });
});