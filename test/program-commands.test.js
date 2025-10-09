import { describe, test, expect } from 'bun:test';
import { BunoshCommand, processCommands } from '../src/program.js';

describe('BunoshCommand', () => {
  test('constructor stores all properties correctly', () => {
    const mockFunction = () => {};
    const command = new BunoshCommand(
      'testCommand',
      'test',
      { arg1: undefined, arg2: 'default' },
      { opt1: true, opt2: 'value' },
      'Test command description',
      mockFunction
    );

    expect(command.name).toBe('testCommand');
    expect(command.namespace).toBe('test');
    expect(command.args).toEqual({ arg1: undefined, arg2: 'default' });
    expect(command.opts).toEqual({ opt1: true, opt2: 'value' });
    expect(command.comment).toBe('Test command description');
    expect(command.function).toBe(mockFunction);
  });

  test('constructor handles empty namespace', () => {
    const mockFunction = () => {};
    const command = new BunoshCommand(
      'simpleCommand',
      '',
      {},
      {},
      '',
      mockFunction
    );

    expect(command.namespace).toBe('');
  });

  test('fullName returns correct format', () => {
    const commandWithNamespace = new BunoshCommand('cmd', 'ns', {}, {}, '', () => {});
    expect(commandWithNamespace.fullName).toBe('ns:cmd');

    const commandWithoutNamespace = new BunoshCommand('cmd', '', {}, {}, '', () => {});
    expect(commandWithoutNamespace.fullName).toBe('cmd');
  });

  test('cliName converts to kebab-case correctly', () => {
    const commandWithNamespace = new BunoshCommand('testCommand', 'dev', {}, {}, '', () => {});
    expect(commandWithNamespace.cliName).toBe('dev:test-command');

    const commandWithoutNamespace = new BunoshCommand('helloWorld', '', {}, {}, '', () => {});
    expect(commandWithoutNamespace.cliName).toBe('hello-world');

    const commandWithoutNamespaceSingle = new BunoshCommand('simple', '', {}, {}, '', () => {});
    expect(commandWithoutNamespaceSingle.cliName).toBe('simple');
  });

  test('allParams returns combined args and opts', () => {
    const command = new BunoshCommand(
      'cmd',
      '',
      { arg1: undefined, arg2: 'default' },
      { opt1: true, opt2: 'value' },
      '',
      () => {}
    );

    const allParams = command.allParams;
    expect(allParams).toContain('arg1');
    expect(allParams).toContain('arg2');
    expect(allParams).toContain('opt1');
    expect(allParams).toContain('opt2');
    expect(allParams).toHaveLength(4);
  });

  test('requiredParams returns only undefined args', () => {
    const command = new BunoshCommand(
      'cmd',
      '',
      { arg1: undefined, arg2: 'default', arg3: undefined },
      {},
      '',
      () => {}
    );

    const requiredParams = command.requiredParams;
    expect(requiredParams).toContain('arg1');
    expect(requiredParams).toContain('arg3');
    expect(requiredParams).not.toContain('arg2');
    expect(requiredParams).toHaveLength(2);
  });
});

describe('processCommands', () => {
  test('processes simple commands without namespace', () => {
    const commands = {
      helloWorld: function(name) { return `Hello ${name}!`; }
    };

    const sources = {
      helloWorld: {
        source: `
/**
 * Says hello to someone
 * @param {string} name - The name to greet
 */
export function helloWorld(name) {
  return \`Hello \${name}!\`;
}`,
        namespace: '',
        originalFnName: 'helloWorld'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(BunoshCommand);
    expect(result[0].name).toBe('helloWorld');
    expect(result[0].namespace).toBe('');
    expect(result[0].comment).toBe('Says hello to someone');
    expect(result[0].args).toEqual({ name: undefined });
    expect(result[0].opts).toEqual({});
  });

  test('processes commands with default arguments', () => {
    const commands = {
      greet: function(name = 'World') { return `Hello ${name}!`; }
    };

    const sources = {
      greet: {
        source: `
/**
 * Greets someone with a default name
 * @param {string} name - The name to greet
 */
export function greet(name = 'World') {
  return \`Hello \${name}!\`;
}`,
        namespace: '',
        originalFnName: 'greet'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0].args).toEqual({ name: 'World' });
  });

  test('processes commands with options object', () => {
    const commands = {
      build: function(options = {}) { return 'Building...'; }
    };

    const sources = {
      build: {
        source: `
/**
 * Builds the project
 * @param {Object} options - Build options
 * @param {boolean} options.production - Production build
 * @param {string} options.output - Output directory
 */
export function build(options = {}) {
  return 'Building...';
}`,
        namespace: '',
        originalFnName: 'build'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0].opts).toEqual({});
  });

  test('processes namespaced commands', () => {
    const commands = {
      'dev:test': function() { return 'Development test'; }
    };

    const sources = {
      'dev:test': {
        source: `
/**
 * Development test command
 */
export function test() {
  return 'Development test';
}`,
        namespace: 'dev',
        originalFnName: 'test'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('test');
    expect(result[0].namespace).toBe('dev');
    expect(result[0].fullName).toBe('dev:test');
  });

  test('processes multiple commands', () => {
    const commands = {
      cmd1: function() { return 'Command 1'; },
      cmd2: function(arg) { return `Command 2: ${arg}`; },
      'dev:cmd3': function() { return 'Dev command 3'; }
    };

    const sources = {
      cmd1: {
        source: 'export function cmd1() { return "Command 1"; }',
        namespace: '',
        originalFnName: 'cmd1'
      },
      cmd2: {
        source: 'export function cmd2(arg) { return `Command 2: ${arg}`; }',
        namespace: '',
        originalFnName: 'cmd2'
      },
      'dev:cmd3': {
        source: 'export function cmd3() { return "Dev command 3"; }',
        namespace: 'dev',
        originalFnName: 'cmd3'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(3);

    const cmd1 = result.find(c => c.name === 'cmd1');
    const cmd2 = result.find(c => c.name === 'cmd2');
    const devCmd3 = result.find(c => c.name === 'cmd3');

    expect(cmd1.namespace).toBe('');
    expect(cmd2.args).toEqual({ arg: undefined });
    expect(devCmd3.namespace).toBe('dev');
  });

  test('handles missing comments gracefully', () => {
    const commands = {
      noComment: function() { return 'No comment'; }
    };

    const sources = {
      noComment: {
        source: 'export function noComment() { return "No comment"; }',
        namespace: '',
        originalFnName: 'noComment'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe('');
  });

  test('handles complex function signatures', () => {
    const commands = {
      complex: function(arg1, arg2 = 'default', options = {}) {
        return `Complex: ${arg1}, ${arg2}`;
      }
    };

    const sources = {
      complex: {
        source: `
/**
 * Complex function with mixed parameters
 * @param {string} arg1 - First argument
 * @param {string} arg2 - Second argument with default
 * @param {Object} options - Options object
 */
export function complex(arg1, arg2 = 'default', options = {}) {
  return \`Complex: \${arg1}, \${arg2}\`;
}`,
        namespace: '',
        originalFnName: 'complex'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(1);
    expect(result[0].args).toEqual({ arg1: undefined, arg2: 'default' });
    expect(result[0].opts).toEqual({});
  });

  test('preserves function references', () => {
    const mockFunction1 = () => 'Function 1';
    const mockFunction2 = () => 'Function 2';

    const commands = {
      func1: mockFunction1,
      func2: mockFunction2
    };

    const sources = {
      func1: {
        source: 'export function func1() { return "Function 1"; }',
        namespace: '',
        originalFnName: 'func1'
      },
      func2: {
        source: 'export function func2() { return "Function 2"; }',
        namespace: '',
        originalFnName: 'func2'
      }
    };

    const result = processCommands(commands, sources);

    expect(result).toHaveLength(2);
    expect(result[0].function).toBe(mockFunction1);
    expect(result[1].function).toBe(mockFunction2);
  });

  test('handles empty commands and sources', () => {
    const result = processCommands({}, {});
    expect(result).toHaveLength(0);
  });

  test('throws syntax error for invalid code', () => {
    const commands = {
      invalid: function() { return 'Should not parse'; }
    };

    const sources = {
      invalid: {
        source: 'export function invalid( { // Invalid syntax',
        namespace: '',
        originalFnName: 'invalid'
      }
    };

    expect(() => processCommands(commands, sources)).toThrow('Unexpected token');
  });
});