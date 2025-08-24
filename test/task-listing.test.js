import { describe, test, expect } from 'bun:test';
import fs from 'fs';

describe('Task Listing Display', () => {
  test('task listing uses correct color scheme', () => {
    // Read the program.js file to verify color configuration
    const programContent = fs.readFileSync('/home/davert/projects/bunosh/src/program.js', 'utf8');
    
    // Verify task names are bold white
    expect(programContent).toContain('subcommandTerm: (cmd) => color.white.bold(cmd.name())');
    
    // Verify descriptions are gray (not dim)
    expect(programContent).toContain('subcommandDescription: (cmd) => color.gray(cmd.description())');
    
    // Verify usage examples use gray for command and blue for args/opts
    expect(programContent).toContain('color.gray(`bunosh ${commandName}`)');
    expect(programContent).toContain('color.blue(argsAndOptsDescription.join');
  });

  test('pickColorForColorName function has been removed', () => {
    // Read the program.js file to verify the color picker function is removed
    const programContent = fs.readFileSync('/home/davert/projects/bunosh/src/program.js', 'utf8');
    
    // Verify the function no longer exists
    expect(programContent).not.toContain('function pickColorForColorName');
    expect(programContent).not.toContain('const colors = [');
  });

  test('help output formatting is consistent', () => {
    // This is more of a documentation test to verify the expected format
    // The actual help output should show:
    // - Task names in bold white
    // - Descriptions in gray
    // - Usage examples with gray command and blue args/opts
    
    // We can't easily test the actual colored output in automated tests,
    // but we can verify the configuration is correct
    const programContent = fs.readFileSync('/home/davert/projects/bunosh/src/program.js', 'utf8');
    
    // Ensure we're not using rainbow colors for command names anymore
    expect(programContent).not.toContain('color.red');
    expect(programContent).not.toContain('color.green'); 
    expect(programContent).not.toContain('color.yellow');
    expect(programContent).not.toContain('color.magenta');
    expect(programContent).not.toContain('color.cyan');
    
    // But blue should still be used for args/opts
    expect(programContent).toContain('color.blue(argsAndOptsDescription');
  });
});