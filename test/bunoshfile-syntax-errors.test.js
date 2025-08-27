import { describe, test, expect } from 'bun:test';
import babelParser from '@babel/parser';

describe('Bunoshfile Syntax Error Detection', () => {
  test('detects variable redeclaration syntax error', () => {
    const invalidCode = `
const message = "hello";
const message = "world"; // VarRedeclaration error

export function testTask() {
  console.log(message);
}
`;
    
    let caughtError;
    try {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (error) {
      caughtError = error;
    }
    
    expect(caughtError).toBeDefined();
    expect(caughtError.reasonCode).toBe('VarRedeclaration');
    expect(caughtError.loc).toBeDefined();
    expect(caughtError.loc.line).toBe(3); // Line with second const declaration
  });

  test('detects unclosed bracket syntax error', () => {
    const invalidCode = `
export function testTask() {
  const obj = {
    name: "test",
    value: 42
    // Missing closing brace
  console.log(obj);
}
`;
    
    let caughtError;
    try {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (error) {
      caughtError = error;
    }
    
    expect(caughtError).toBeDefined();
    expect(caughtError.loc).toBeDefined();
    expect(typeof caughtError.reasonCode).toBe('string');
    expect(caughtError.loc.line).toBeGreaterThan(0);
  });

  test('parses valid syntax without errors', () => {
    const validCode = `
export function testTask() {
  console.log("This is a valid task");
}

export function anotherTask(name = "world") {
  console.log(\`Hello, \${name}!\`);
}
`;
    
    let ast;
    expect(() => {
      ast = babelParser.parse(validCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    }).not.toThrow();
    
    expect(ast).toBeDefined();
    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBe(2); // Two export function declarations
  });

  test('error contains expected properties for debugging', () => {
    const invalidCode = `export function broken( { // Missing closing parenthesis`;
    
    let caughtError;
    try {
      babelParser.parse(invalidCode, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (error) {
      caughtError = error;
    }
    
    expect(caughtError).toBeDefined();
    expect(caughtError.loc).toBeDefined();
    expect(caughtError.loc.line).toBeGreaterThan(0);
    expect(caughtError.loc.column).toBeGreaterThanOrEqual(0);
    expect(typeof caughtError.message).toBe('string');
    expect(typeof caughtError.reasonCode).toBe('string');
  });
});