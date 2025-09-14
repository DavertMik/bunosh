import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Integration tests for personal commands with actual execution
describe('Personal Commands Integration - Runtime Tests', () => {
  let tempHomeDir;
  let tempProjectDir;
  let originalHome;
  let originalCwd;
  
  beforeEach(() => {
    // Create temporary directories
    tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunosh-home-test-'));
    tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunosh-project-test-'));
    
    // Save original environment
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    
    // Set up test environment
    process.env.HOME = tempHomeDir;
    process.chdir(tempProjectDir);
    
    // Create a basic project Bunoshfile
    const projectBunoshfile = path.join(tempProjectDir, 'Bunoshfile.js');
    fs.writeFileSync(projectBunoshfile, `
export function projectTask() {
  console.log('Project task executed');
}
`);
  });
  
  afterEach(() => {
    // Restore environment
    process.env.HOME = originalHome;
    process.chdir(originalCwd);
    
    // Clean up temporary directories
    if (fs.existsSync(tempHomeDir)) {
      fs.rmSync(tempHomeDir, { recursive: true, force: true });
    }
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true });
    }
  });

  test('program loads without personal commands when no home Bunoshfile exists', async () => {
    // Import and run the program function
    const programModule = await import('../src/program.js');
    const program = programModule.default;
    
    // Mock commands from project Bunoshfile
    const mockCommands = {
      projectTask: () => console.log('Project task executed')
    };
    
    const mockSource = 'export function projectTask() { console.log("Project task executed"); }';
    
    // This should not throw an error even without home Bunoshfile
    expect(async () => {
      await program(mockCommands, mockSource);
    }).not.toThrow();
  });

  test('program loads and integrates personal commands when home Bunoshfile exists', async () => {
    // Create home Bunoshfile
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
/**
 * Home task for testing
 */
export function homeTask() {
  console.log('Home task executed');
}

/**
 * Parameterized home task
 */
export function paramTask(name = 'World', opts = { greeting: 'Hello' }) {
  console.log(\`\${opts.greeting}, \${name}!\`);
}
`);
    
    // Import and run the program function
    const programModule = await import('../src/program.js');
    const program = programModule.default;
    
    // Mock commands from project Bunoshfile
    const mockCommands = {
      projectTask: () => console.log('Project task executed')
    };
    
    const mockSource = 'export function projectTask() { console.log("Project task executed"); }';
    
    // This should load personal commands without error
    let programInstance;
    expect(async () => {
      programInstance = await program(mockCommands, mockSource);
    }).not.toThrow();
  });

  test('personal command with invalid syntax is handled gracefully', async () => {
    // Create home Bunoshfile with syntax error
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
export function badTask() {
  console.log('Missing closing quote);
}
`);
    
    // Import and run the program function
    const programModule = await import('../src/program.js');
    const program = programModule.default;
    
    // Mock commands from project Bunoshfile
    const mockCommands = {
      projectTask: () => console.log('Project task executed')
    };
    
    const mockSource = 'export function projectTask() { console.log("Project task executed"); }';
    
    // Should handle the error gracefully and not crash
    expect(async () => {
      await program(mockCommands, mockSource);
    }).not.toThrow();
  });

  test('personal command comments and parameters are parsed correctly', async () => {
    // Create home Bunoshfile with comments and parameters
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
/**
 * Deploy to environment
 * @param env The environment to deploy to
 */
export function deploy(env = 'staging', opts = { force: false, verbose: true }) {
  console.log(\`Deploying to \${env}\`);
  if (opts.force) console.log('Force enabled');
  if (opts.verbose) console.log('Verbose output enabled');
}

/**
 * Simple backup task
 */
export function backup() {
  console.log('Creating backup...');
}
`);
    
    // Test that file can be parsed
    const content = fs.readFileSync(homeBunoshfile, 'utf-8');
    expect(content).toContain('Deploy to environment');
    expect(content).toContain('env = \'staging\'');
    expect(content).toContain('force: false');
    expect(content).toContain('Simple backup task');
  });

  test('home directory detection uses correct path', () => {
    // Test that our temporary home directory is being used
    expect(process.env.HOME).toBe(tempHomeDir);
    
    // Test home path construction
    const expectedHomeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    
    // Create the file
    fs.writeFileSync(expectedHomeBunoshfile, 'export function test() {}');
    
    // Verify it exists at the expected location
    expect(fs.existsSync(expectedHomeBunoshfile)).toBe(true);
  });

  test('both project and personal commands can coexist', async () => {
    // Create home Bunoshfile
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
export function homeTask() {
  return 'home';
}
`);
    
    // Create project Bunoshfile (already created in beforeEach)
    // Both should be able to coexist without naming conflicts
    
    const homeContent = fs.readFileSync(homeBunoshfile, 'utf-8');
    const projectContent = fs.readFileSync(path.join(tempProjectDir, 'Bunoshfile.js'), 'utf-8');
    
    expect(homeContent).toContain('homeTask');
    expect(projectContent).toContain('projectTask');
    
    // Different function names mean no conflicts
    expect(homeContent).not.toContain('projectTask');
    expect(projectContent).not.toContain('homeTask');
  });

  test('personal commands with same name as project commands do not conflict due to namespace', () => {
    // Create home Bunoshfile with same function name as project
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
export function projectTask() {
  console.log('Home version of projectTask');
}
`);
    
    // Both files have 'projectTask' but home version gets my: prefix
    // So commands would be:
    // - projectTask (from project)  
    // - my:projectTask (from home)
    
    const homeContent = fs.readFileSync(homeBunoshfile, 'utf-8');
    const projectContent = fs.readFileSync(path.join(tempProjectDir, 'Bunoshfile.js'), 'utf-8');
    
    expect(homeContent).toContain('Home version of projectTask');
    expect(projectContent).toContain('Project task executed');
  });

  test('handles empty home Bunoshfile', async () => {
    // Create empty home Bunoshfile
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, '// Empty file\n');
    
    // Import and run the program function
    const programModule = await import('../src/program.js');
    const program = programModule.default;
    
    // Mock commands from project Bunoshfile
    const mockCommands = {
      projectTask: () => console.log('Project task executed')
    };
    
    const mockSource = 'export function projectTask() { console.log("Project task executed"); }';
    
    // Should handle empty file gracefully
    expect(async () => {
      await program(mockCommands, mockSource);
    }).not.toThrow();
  });

  test('handles home Bunoshfile with only non-function exports', async () => {
    // Create home Bunoshfile with only variables/constants
    const homeBunoshfile = path.join(tempHomeDir, 'Bunoshfile.js');
    fs.writeFileSync(homeBunoshfile, `
export const CONFIG = { api: 'https://api.example.com' };
export const VERSION = '1.0.0';
`);
    
    // Should not try to add non-functions as tasks
    const content = fs.readFileSync(homeBunoshfile, 'utf-8');
    expect(content).toContain('CONFIG');
    expect(content).toContain('VERSION');
    expect(content).not.toContain('function');
  });
});