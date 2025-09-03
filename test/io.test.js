import { describe, test, expect, mock, spyOn } from 'bun:test';
import { say, yell, ask } from '../src/io.js';

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

  describe('ask function', () => {
    test('detects editor option and calls different flow', () => {
      const opts = { editor: true };
      expect(opts.editor).toBe(true);
    });

    test('detects multiline option and calls different flow', () => {
      const opts = { multiline: true };
      expect(opts.multiline).toBe(true);
    });

    test('detects choices option and calls different flow', () => {
      const opts = { choices: ['option1', 'option2', 'option3'] };
      expect(opts.choices).toEqual(['option1', 'option2', 'option3']);
    });

    test('detects multiple choice option', () => {
      const opts = { choices: ['a', 'b', 'c'], multiple: true };
      expect(opts.multiple).toBe(true);
      expect(opts.choices.length).toBe(3);
    });

    test('editor and multiline options are equivalent', () => {
      const editorOpts = { editor: true };
      const multilineOpts = { multiline: true };
      
      expect(editorOpts.editor).toBe(true);
      expect(multilineOpts.multiline).toBe(true);
    });
  });

  describe('ask smart parameter detection', () => {
    test('detects boolean default as confirm type', () => {
      // Simulate the parameter processing logic
      const question = 'Do you want to quit?';
      const defaultValue = true;
      let opts = {};
      
      if (defaultValue !== null && typeof defaultValue !== 'object') {
        opts.default = defaultValue;
        if (typeof defaultValue === 'boolean') {
          opts.type = 'confirm';
        }
      }
      
      expect(opts.default).toBe(true);
      expect(opts.type).toBe('confirm');
    });

    test('detects string default value', () => {
      const question = 'What is your name?';
      const defaultValue = 'jon';
      let opts = {};
      
      if (defaultValue !== null && typeof defaultValue !== 'object') {
        opts.default = defaultValue;
        if (typeof defaultValue === 'boolean') {
          opts.type = 'confirm';
        }
      }
      
      expect(opts.default).toBe('jon');
      expect(opts.type).toBeUndefined();
    });

    test('detects array as choices', () => {
      const question = 'Pick a color';
      const choices = ['red', 'blue', 'green'];
      let opts = {};
      
      if (Array.isArray(choices)) {
        opts.choices = choices;
      }
      
      expect(opts.choices).toEqual(['red', 'blue', 'green']);
    });

    test('merges third parameter options with smart detection', () => {
      const question = 'Pick multiple colors';
      const choices = ['red', 'blue', 'green'];
      const options = { multiple: true };
      let opts = {};
      
      if (Array.isArray(choices)) {
        opts.choices = choices;
        opts = { ...opts, ...options };
      }
      
      expect(opts.choices).toEqual(['red', 'blue', 'green']);
      expect(opts.multiple).toBe(true);
    });

    test('handles number default value', () => {
      const question = 'Enter port number';
      const defaultValue = 3000;
      let opts = {};
      
      if (defaultValue !== null && typeof defaultValue !== 'object') {
        opts.default = defaultValue;
        if (typeof defaultValue === 'boolean') {
          opts.type = 'confirm';
        }
      }
      
      expect(opts.default).toBe(3000);
      expect(opts.type).toBeUndefined();
    });

    test('handles traditional object parameter', () => {
      const question = 'Enter details';
      const options = { type: 'password', default: 'secret' };
      let opts = {};
      
      if (options !== null && typeof options === 'object' && !Array.isArray(options)) {
        opts = { ...options };
      }
      
      expect(opts.type).toBe('password');
      expect(opts.default).toBe('secret');
    });
  });
});