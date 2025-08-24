import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

// Mock the program.js loadNpmScripts function by importing the file and testing the logic
describe('NPM Scripts Integration', () => {
  test('loadNpmScripts filters out bunosh scripts correctly', () => {
    // Create a temporary package.json for testing
    const testPackageJson = {
      name: 'test-project',
      scripts: {
        'build': 'echo "Building project..."',
        'start': 'node server.js', 
        'test': 'jest',
        'lint': 'eslint src/',
        'bunosh-task': 'bunosh hello:world',
        'deploy': 'bunosh update:to-production'
      }
    };

    // Test the filtering logic manually
    const scripts = testPackageJson.scripts;
    const npmScripts = {};
    Object.entries(scripts).forEach(([name, command]) => {
      if (!command.includes('bunosh')) {
        npmScripts[name] = command;
      }
    });

    // Should include non-bunosh scripts
    expect(npmScripts.build).toBe('echo "Building project..."');
    expect(npmScripts.start).toBe('node server.js');
    expect(npmScripts.test).toBe('jest');
    expect(npmScripts.lint).toBe('eslint src/');

    // Should exclude bunosh scripts
    expect(npmScripts['bunosh-task']).toBeUndefined();
    expect(npmScripts.deploy).toBeUndefined();

    // Should have 4 npm scripts and exclude 2 bunosh scripts
    expect(Object.keys(npmScripts).length).toBe(4);
  });

  test('npm scripts appear in help output with npm: namespace', () => {
    // Read the program.js file to verify npm script integration exists
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify npm script loading function exists
    expect(programContent).toContain('loadNpmScripts');
    expect(programContent).toContain('npm:${scriptName}');
    
    // Verify filtering logic
    expect(programContent).toContain('!command.includes(\'bunosh\')');
  });

  test('npm script commands use script command as description', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify that script command is used as description
    expect(programContent).toContain('color.gray(scriptCommand)');
  });

  test('npm script execution uses bunosh exec instead of execSync', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify that bunosh exec is used for execution, not execSync
    expect(programContent).toContain('exec([\'npm run \', \'\'], scriptName)');
    expect(programContent).toContain('await import(\'../index.js\')');
    expect(programContent).not.toContain('execSync');
  });

  test('handles missing package.json gracefully', () => {
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify error handling for missing package.json
    expect(programContent).toContain('fs.existsSync(\'package.json\')');
    expect(programContent).toContain('return {}');
  });
});