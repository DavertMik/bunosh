#!/usr/bin/env bun

import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

// Create a temporary directory for testing
const testDir = fs.mkdtempSync(path.join(tmpdir(), 'bunosh-error-test-'));
const originalCwd = process.cwd();

console.log('🧪 Testing Bunosh error handling...');
console.log(`Test directory: ${testDir}`);

process.chdir(testDir);

// Test 1: Variable redeclaration error
console.log('\n1️⃣  Testing variable redeclaration error...');
const invalidCode1 = `
const message = "hello";
const message = "world"; // This should cause an error

export function testTask() {
  console.log(message);
}
`;

fs.writeFileSync('Bunoshfile.js', invalidCode1);

try {
  const { spawn } = require('child_process');
  const bunosh = spawn('bunosh', ['--help'], { stdio: 'pipe' });
  
  let output = '';
  bunosh.stdout.on('data', (data) => output += data);
  bunosh.stderr.on('data', (data) => output += data);
  
  bunosh.on('close', (code) => {
    if (code === 1 && output.includes('Syntax Error')) {
      console.log('✅ Variable redeclaration error handled correctly');
      console.log('Output preview:', output.substring(0, 200) + '...');
    } else {
      console.log('❌ Variable redeclaration error not handled properly');
      console.log('Exit code:', code);
      console.log('Output:', output);
    }
    
    // Test 2: Valid Bunoshfile
    console.log('\n2️⃣  Testing valid Bunoshfile...');
    const validCode = `
export function testTask() {
  console.log("This is a valid task");
}
`;
    
    fs.writeFileSync('Bunoshfile.js', validCode);
    
    const bunosh2 = spawn('bunosh', ['--help'], { stdio: 'pipe' });
    let output2 = '';
    bunosh2.stdout.on('data', (data) => output2 += data);
    bunosh2.stderr.on('data', (data) => output2 += data);
    
    bunosh2.on('close', (code) => {
      if (code === 0 && output2.includes('test:task')) {
        console.log('✅ Valid Bunoshfile handled correctly');
      } else {
        console.log('❌ Valid Bunoshfile failed');
        console.log('Exit code:', code);
        console.log('Output:', output2);
      }
      
      // Cleanup
      process.chdir(originalCwd);
      fs.rmSync(testDir, { recursive: true, force: true });
      console.log('\n✨ Test completed!');
    });
  });
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.chdir(originalCwd);
  fs.rmSync(testDir, { recursive: true, force: true });
}