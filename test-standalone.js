#!/usr/bin/env bun
// Test standalone executable that tries to load external file with imports

import { readFileSync } from 'fs';
import path from 'path';

const externalFile = './test-external/test-bunoshfile.js';

try {
  console.log('Method 1: Direct import()');
  const module1 = await import(path.resolve(externalFile));
  console.log('SUCCESS: Direct import worked');
  await module1.testImports();
} catch (error) {
  console.log('FAILED: Direct import -', error.message);
}

try {
  console.log('\nMethod 2: Read as text + eval');
  const code = readFileSync(externalFile, 'utf8');
  // Remove import statements for eval test
  const codeWithoutImports = code
    .replace(/import.*from.*['"][^'"]*['"];?\n?/g, '')
    .replace('export async function', 'async function');
  
  console.log('Code to eval:', codeWithoutImports.slice(0, 100) + '...');
  eval(codeWithoutImports);
  console.log('SUCCESS: Eval worked (without imports)');
} catch (error) {
  console.log('FAILED: Eval -', error.message);
}

try {
  console.log('\nMethod 3: Dynamic import from CWD');
  process.chdir('./test-external');
  const module3 = await import('./test-bunoshfile.js');
  console.log('SUCCESS: Dynamic import from correct CWD worked');
  await module3.testImports();
} catch (error) {
  console.log('FAILED: Dynamic import from CWD -', error.message);
}