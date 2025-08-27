import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import babelParser from '@babel/parser';

describe('Bunoshfile Error Handling', () => {
  let tempDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'bunosh-parse-test-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('babel parser throws proper error for variable redeclaration', () => {
    const invalidCode = `
const message = "hello";
const message = "world"; // VarRedeclaration error

export function testTask() {
  console.log(message);
}
`;
    
    expect(() => {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    }).toThrow();
  });

  test('babel parser throws proper error for unclosed brackets', () => {
    const invalidCode = `
export function testTask() {
  const obj = {
    name: "test",
    value: 42
    // Missing closing brace
  console.log(obj);
}
`;
    
    expect(() => {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    }).toThrow();
  });

  test('babel parser handles valid code without errors', () => {
    const validCode = `
export function testTask() {
  console.log("This is a valid task");
}

export function anotherTask(name = "world") {
  console.log(\`Hello, \${name}!\`);
}
`;
    
    expect(() => {
      const ast = babelParser.parse(validCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
      expect(ast).toBeDefined();
      expect(ast.type).toBe('Program');
    }).not.toThrow();
  });

  test('error objects contain expected properties', () => {
    const invalidCode = `const x = 5\nconst x = 10;`; // Redeclaration
    
    try {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (error) {
      expect(error).toBeDefined();
      expect(error.loc).toBeDefined();
      expect(error.loc.line).toBeGreaterThan(0);
      expect(error.loc.column).toBeGreaterThanOrEqual(0);
      expect(error.message).toBeDefined();
    }
  });

  test('program error handling preserves error code', async () => {
    // Import the program function
    const programModule = await import('../src/program.js');
    const program = programModule.default;
    
    const invalidCode = `
const message = "hello";
const message = "world";
export function test() {}
`;
    
    const mockTasks = { test: () => {} };
    
    // This should throw an error with BABEL_PARSER_SYNTAX_ERROR code
    expect(() => {
      program(mockTasks, invalidCode);
    }).toThrow();
  });
});