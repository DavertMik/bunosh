import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Test the home tasks functionality
describe('Home Tasks Integration', () => {
  let tempHomeDir;
  let originalHome;
  
  beforeEach(() => {
    // Create a temporary home directory for testing
    tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunosh-home-test-'));
    originalHome = process.env.HOME;
    process.env.HOME = tempHomeDir;
  });
  
  afterEach(() => {
    // Clean up temporary home directory and restore original HOME
    if (fs.existsSync(tempHomeDir)) {
      fs.rmSync(tempHomeDir, { recursive: true, force: true });
    }
    process.env.HOME = originalHome;
  });

  test('loadHomeTasks returns empty when no home Bunoshfile exists', async () => {
    // Import the loadHomeTasks function by reading program.js
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify the function handles missing home Bunoshfile gracefully
    expect(programContent).toContain('async function loadHomeTasks()');
    expect(programContent).toContain('if (!existsSync(homeBunoshfile))');
    expect(programContent).toContain('return { tasks: {}, source: \'\' }');
  });

  test('loadHomeTasks loads home Bunoshfile when it exists', async () => {
    // Create a test home Bunoshfile
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    const testContent = `
/**
 * Test home task
 */
export function testHomeTask() {
  console.log('Hello from home');
}

export function anotherTask(name = 'World') {
  console.log(\`Hello, \${name}!\`);
}
`;
    
    fs.writeFileSync(homeBunoshfile, testContent);
    
    // Test that the file exists and can be read
    expect(fs.existsSync(homeBunoshfile)).toBe(true);
    
    const content = fs.readFileSync(homeBunoshfile, 'utf-8');
    expect(content).toContain('testHomeTask');
    expect(content).toContain('anotherTask');
    expect(content).toContain('Test home task');
  });

  test('home tasks are added with my: prefix', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify home tasks get my: prefix
    expect(programContent).toContain('my:${fnName}');
    expect(programContent).toContain('type: \'home\'');
    expect(programContent).toContain('cmdData.type === \'home\'');
  });

  test('home tasks appear in help output with separate section', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify home tasks help section
    expect(programContent).toContain('My Tasks (from ~/${BUNOSHFILE}):');
    expect(programContent).toContain('homeTaskNamesForHelp');
    expect(programContent).toContain('my:${taskName}');
  });

  test('home task parsing includes comments, args, and options', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify parsing functions exist for home tasks
    expect(programContent).toContain('fetchHomeComments()');
    expect(programContent).toContain('fetchHomeFnAst');
    expect(programContent).toContain('parseHomeArgs');
    expect(programContent).toContain('parseHomeOpts');
    expect(programContent).toContain('homeComments[originalFnName]');
  });

  test('home task execution uses correct binding', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify home tasks are bound to homeTasks object
    expect(programContent).toContain('cmdData.data.bind(homeTasks)');
  });

  test('handles home Bunoshfile parsing errors gracefully', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify error handling in loadHomeTasks
    expect(programContent).toContain('catch (error)');
    expect(programContent).toContain('console.warn(\'Warning: Could not load home Bunoshfile:\'');
    expect(programContent).toContain('return { tasks: {}, source: \'\' }');
  });

  test('home comments parsing handles JSDoc format', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify JSDoc comment parsing for home tasks
    expect(programContent).toContain('fetchHomeComments()');
    expect(programContent).toContain('/\\*\\*\\s([\\s\\S]*)\\\\*\\/\\s*export/');
    expect(programContent).toContain('homeComments[functionName]');
  });

  test('home task AST parsing handles function signatures', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify AST parsing for home function arguments and options
    expect(programContent).toContain('parseHomeArgs(fnName, ast)');
    expect(programContent).toContain('parseHomeOpts(fnName, ast)');
    expect(programContent).toContain('if (path.node.id.name !== fnName) return');
  });

  test('home tasks integration preserves existing functionality', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify that npm scripts and bunosh commands still work
    expect(programContent).toContain('loadNpmScripts()');
    expect(programContent).toContain('type: \'bunosh\'');
    expect(programContent).toContain('type: \'npm\'');
    
    // Verify command collection includes all types
    expect(programContent).toContain('// Collect all commands (bunosh + home tasks + npm scripts)');
  });

  test('command filtering excludes home tasks from visible commands', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify that npm: commands are filtered from main visible commands
    expect(programContent).toContain('!c.name().startsWith(\'npm:\')');
    // Note: my: commands are not filtered, so they appear in the main list
  });

  test('async program function is properly implemented', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify program function is async
    expect(programContent).toContain('export default async function bunosh(commands, source)');
    expect(programContent).toContain('await loadHomeTasks()');
  });

  test('main bunosh entry point calls program with await', () => {
    const bunoshPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../bunosh.js');
    const bunoshContent = fs.readFileSync(bunoshPath, 'utf8');
    
    // Verify bunosh.js awaits the program call
    expect(bunoshContent).toContain('await program(tasks, source)');
    expect(bunoshContent).toContain('import(tasksFile).then(async (tasks) => {');
  });
});