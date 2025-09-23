import { describe, test, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Task Listing Display', () => {
  test('task listing uses correct color scheme', () => {
    // Read the program.js file to verify color configuration
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify task names are bold white
    expect(programContent).toContain('subcommandTerm: (cmd) => color.white.bold(cmd.name())');
    
    // Verify descriptions are gray (not dim)
    expect(programContent).toContain('subcommandDescription: (cmd) => color.gray(cmd.description())');
    
    // Verify usage examples use gray for command and blue for args/opts
    expect(programContent).toContain('color.gray(`bunosh ${commandName}`)');
    expect(programContent).toContain('color.blue(argsAndOptsDescription.join(\' \').trim())');
  });

  test('pickColorForColorName function has been removed', () => {
    // Read the program.js file to verify the color picker function is removed
    const programPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../src/program.js');
    const programContent = fs.readFileSync(programPath, 'utf8');
    
    // Verify the old color picker function no longer exists
    expect(programContent).not.toContain('function pickColorForColorName');
    expect(programContent).not.toContain('pickColorForColorName = function');
    
    // Verify the new gradient implementation exists
    expect(programContent).toContain('createGradientAscii');
    expect(programContent).toContain('startColor = { r: 255, g: 220, b: 0 }');
    expect(programContent).toContain('endColor = { r: 139, g: 69, b: 19 }');
  });

});