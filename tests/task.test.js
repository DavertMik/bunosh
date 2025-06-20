// Set environment variables BEFORE importing modules
process.env.FORCE_RICH_UI = '1';
delete process.env.CI;

import { test, expect, beforeEach, afterEach, describe } from 'bun:test';
import { exec, ignoreFail } from '../index.js';

describe('Rich UI Mode Live Output', () => {
  let originalConsoleLog;
  let consoleOutput = [];

  beforeEach(() => {
    // Capture console.log output for testing
    originalConsoleLog = console.log;
    consoleOutput = [];
    console.log = (...args) => {
      consoleOutput.push(args.join(' '));
    };
    
    // Ignore failures during testing to prevent process.exit
    ignoreFail(true);
  });

  afterEach(() => {
    // Restore original console.log
    console.log = originalConsoleLog;
  });

  test('should show colorized status line for successful exec commands', async () => {
    await exec`echo "test output"`;
    
    // Wait a bit for any async console output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find the Rich UI status line (shorter format without "Time taken:")
    const richUIStatusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && line.includes('test output') &&
      !line.includes('Time taken:') // Rich UI format doesn't have this
    );
    
    expect(richUIStatusLines.length).toBe(1);
    
    const statusLine = richUIStatusLines[0];
    
    // Should contain ANSI color codes for green checkmark
    expect(statusLine).toMatch(/\[32m.*✓.*\[39m/); // Green color codes
    
    // Should contain bold formatting for 'exec'
    expect(statusLine).toMatch(/\[1m.*exec.*\[22m/); // Bold formatting
    
    // Should contain underline formatting for command text
    expect(statusLine).toMatch(/\[4m.*test output.*\[24m/); // Underline formatting
    
    // Should contain dim formatting for timing
    expect(statusLine).toMatch(/\[2m.*\d+ms.*\[22m/); // Dim formatting for timing
  });

  test('should show colorized status line for failed exec commands', async () => {
    try {
      await exec`sh -c 'echo "error output"; exit 1'`;
    } catch (error) {
      // Command should fail, but we should still get a status line
    }
    
    // Wait a bit for any async console output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find the Rich UI status line for failed command
    const richUIStatusLines = consoleOutput.filter(line => 
      line.includes('✗') && line.includes('exec') && !line.includes('Time taken:')
    );
    
    expect(richUIStatusLines.length).toBe(1);
    
    const statusLine = richUIStatusLines[0];
    
    // Should contain ANSI color codes for red X mark
    expect(statusLine).toMatch(/\[31m.*✗.*\[39m/); // Red color codes
    
    // Should still have proper formatting
    expect(statusLine).toMatch(/\[1m.*exec.*\[22m/); // Bold 'exec'
    expect(statusLine).toMatch(/\[2m.*\d+ms.*\[22m/); // Dim timing
  });

  test('should not duplicate output in Rich UI mode', async () => {
    await exec`echo "unique test output"`;
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Count how many times the actual command output appears directly
    const directOutputLines = consoleOutput.filter(line => 
      line.includes('unique test output') && 
      !line.includes('✓') && 
      !line.includes('exec') &&
      !line.includes('[') // Exclude ANSI colored output
    );
    
    // Should not have duplicate direct output lines (content appears in live frame only)
    expect(directOutputLines.length).toBe(0);
    
    // But we should have the status line
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && line.includes('unique test output') &&
      !line.includes('Time taken:')
    );
    expect(statusLines.length).toBe(1);
  });

  test('should include extraText in status line when present', async () => {
    // Test with cwd which adds extraText
    await exec`echo "test with cwd"`.cwd('/tmp');
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && line.includes('test with cwd') &&
      !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBe(1);
    
    const statusLine = statusLines[0];
    expect(statusLine).toContain('at /tmp'); // Should include the cwd extraText
  });

  test('should handle commands with multiple output lines', async () => {
    await exec`sh -c 'echo "Line 1"; echo "Line 2"; echo "Line 3"'`;
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have one status line for the entire command
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBe(1);
    
    // Should contain proper timing (accounting for ANSI codes at the end)
    const statusLine = statusLines[0].trim();
    expect(statusLine).toMatch(/\d+ms.*$/); // Should contain timing near the end
  });

  test('should format status line with proper colors and formatting', async () => {
    await exec`echo "consistency test"`;
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && line.includes('consistency test') &&
      !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBe(1);
    
    const statusLine = statusLines[0];
    
    // Should follow the pattern: ✓ exec command timing
    const pattern = /.*✓.*exec.*consistency test.*\d+ms.*/;
    expect(statusLine).toMatch(pattern);
    
    // Should have proper color formatting
    expect(statusLine).toContain('\u001b[32m'); // Green color start
    expect(statusLine).toContain('\u001b[1m');  // Bold start  
    expect(statusLine).toContain('\u001b[4m');  // Underline start
    expect(statusLine).toContain('\u001b[2m');  // Dim start
  });
});

describe('Rich UI Mode Integration Tests', () => {
  let originalConsoleLog;
  let consoleOutput = [];
  
  beforeEach(() => {
    originalConsoleLog = console.log;
    consoleOutput = [];
    console.log = (...args) => {
      consoleOutput.push(args.join(' '));
    };
    
    ignoreFail(true);
  });
  
  afterEach(() => {
    console.log = originalConsoleLog;
  });

  test('should handle rapid sequential commands', async () => {
    await exec`echo "Command 1"`;
    await exec`echo "Command 2"`;
    await exec`echo "Command 3"`;
    
    // Wait for all async output
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should have three separate status lines
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBe(3);
    
    // Each should be properly formatted
    statusLines.forEach(line => {
      expect(line).toMatch(/.*✓.*exec.*\d+ms.*/);
      expect(line).toContain('\u001b[32m'); // Green checkmark
    });
  });

  test('should handle commands with stderr output', async () => {
    await exec`sh -c 'echo "stdout"; echo "stderr" >&2'`;
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBe(1);
    
    // Should still show success since command exit code is 0
    const statusLine = statusLines[0];
    expect(statusLine).toContain('✓');
    expect(statusLine).toContain('\u001b[32m'); // Green color
  });

  test('should handle live output streaming', async () => {
    // Test command that produces output over time
    await exec`sh -c 'echo "Step 1"; sleep 0.1; echo "Step 2"; sleep 0.1; echo "Step 3"'`;
    
    // Wait for async output
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should have captured the colorized status line
    const statusLines = consoleOutput.filter(line => 
      line.includes('✓') && line.includes('exec') && line.includes('Step 1') &&
      !line.includes('Time taken:')
    );
    
    expect(statusLines.length).toBeGreaterThan(0);
    
    // Verify the status line contains the expected components
    const statusLine = statusLines[0];
    expect(statusLine).toContain('exec');
    expect(statusLine).toContain('Step 1');
    expect(statusLine).toMatch(/\d+ms/); // Should contain timing
  });
});