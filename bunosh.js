#!/usr/bin/env bun

// Set up global variables BEFORE any imports
globalThis._bunoshStartTime = Date.now();
globalThis._bunoshCommandCompleted = false;
globalThis._bunoshGlobalTasksExecuted = [];
globalThis._bunoshGlobalTaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success',
  WARNING: 'warning'
};

// Now import modules
// Check for piped input FIRST, before any other imports
function isPipeInput() {
  // In Bun, process.stdin.isTTY is undefined when piped, not false
  return process.stdin.isTTY === undefined || !process.stdin.isTTY;
}

// Read stdin immediately if piped input detected, before other modules can interfere
let stdinData = null;
if (isPipeInput()) {
  // Use synchronous reading to avoid any timing issues
  try {
    const fs = require('fs');
    const buffer = Buffer.alloc(64 * 1024); // 64KB buffer
    const bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
    stdinData = buffer.toString('utf8', 0, bytesRead).trim();
  } catch (error) {
    console.error('Error reading stdin:', error.message);
    stdinData = '';
  }
}

import program, { BUNOSHFILE, banner }  from "./src/program.js";
import { existsSync, readFileSync, statSync } from "fs";
import init from "./src/init.js";
import path from "path";
import color from "chalk";


async function main() {
  // Parse --bunoshfile flag before importing tasks
  const bunoshfileIndex = process.argv.indexOf('--bunoshfile');
  let customBunoshfile = null;
  if (bunoshfileIndex !== -1 && bunoshfileIndex + 1 < process.argv.length) {
    customBunoshfile = process.argv[bunoshfileIndex + 1];
    // Remove the flag and its value from process.argv so it doesn't interfere with command parsing
    process.argv.splice(bunoshfileIndex, 2);
  }

  let tasksFile;
  if (customBunoshfile) {
    const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
    // If it's a directory, append the default BUNOSHFILE
    if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      tasksFile = path.join(resolvedPath, BUNOSHFILE);
      // Change working directory to the bunoshfile directory
      process.chdir(resolvedPath);
    } else {
      tasksFile = resolvedPath;
      // Change working directory to the bunoshfile's directory
      process.chdir(path.dirname(resolvedPath));
    }
  } else {
    tasksFile = path.join(process.cwd(), BUNOSHFILE);
  }

  // Handle piped input first
  if (isPipeInput()) {
    const jsCode = stdinData;
    if (!jsCode) {
      console.error('No JavaScript code provided via stdin');
      process.exit(1);
    }
    
    try {
      // Import bunosh globals before executing piped JavaScript
      await import('./index.js');
      
      // Execute the piped JavaScript code with bunosh globals available
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      
      // Make bunosh globals available to the function by destructuring from global.bunosh
      const globalVars = Object.keys(global.bunosh).map(key => `const ${key} = global.bunosh.${key};`).join('\n');
      const funcBody = `${globalVars}\n${jsCode}`;
      
      const func = new AsyncFunction(funcBody);
      await func();
    } catch (error) {
      console.error('Error executing piped JavaScript:', error.message);
      process.exit(1);
    }
    return;
  }

  if (!existsSync(tasksFile)) {
    banner();

    if (process.argv.includes('init')) {
      init();
      process.exit(0);
    }

    console.log();
    console.error(`Bunoshfile not found: ${tasksFile}`);
    console.log(customBunoshfile ? 
      `Run \`bunosh init\` in the directory or specify a valid --bunoshfile path` :
      "Run `bunosh init` to create a new Bunoshfile here")
    console.log();
    process.exit(1);
  }

  // Import bunosh globals for normal operation
  await import('./index.js');
  
  import(tasksFile).then((tasks) => {
    try {
      const source = readFileSync(tasksFile, "utf-8");
      program(tasks, source);
    } catch (error) {
      handleBunoshfileError(error, tasksFile);
    }
  }).catch((error) => {
    handleBunoshfileError(error, tasksFile);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;
  
  console.error('\n❌ Unhandled Promise Rejection:');
  console.error(reason instanceof Error ? reason.message : reason);
  if (reason instanceof Error && reason.stack && process.env.BUNOSH_DEBUG) {
    console.error(reason.stack);
  }
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;
  
  console.error('\n❌ Uncaught Exception:');
  console.error(error.message);
  if (error.stack && process.env.BUNOSH_DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

// Handle exit for task summary
process.on('exit', (code) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;
  
  // Don't print summary if exit was due to stdin closing during an ask operation
  // This prevents duplicate output when ask commands don't receive all required input
  if (globalThis._bunoshInAskOperation && code === 0) {
    return;
  }
  
  // Access global values directly
  const tasksExecuted = globalThis._bunoshGlobalTasksExecuted || [];
  const TaskStatus = globalThis._bunoshGlobalTaskStatus || { FAIL: 'fail', WARNING: 'warning' };
  
  // Calculate total time from when the process started
  const totalTime = Date.now() - globalThis._bunoshStartTime || 0;
  const tasksFailed = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.FAIL).length;
  const tasksWarning = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.WARNING).length;
  
  // Check if we're in test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test' ||
                            typeof Bun?.jest !== 'undefined' ||
                            process.argv.some(arg => arg.includes('vitest') || arg.includes('jest') || arg.includes('--test') || arg.includes('test:'));
  
  // Set exit code to 1 if any tasks failed AND we're not in test environment
  if (tasksFailed > 0 && !isTestEnvironment) {
    process.exitCode = 1;
  }
  
  const finalExitCode = (tasksFailed > 0 && !isTestEnvironment) ? 1 : code;
  const success = finalExitCode === 0;

  // Debug: Check if this handler has already run
  if (globalThis._bunoshExitHandlerCalled) {
    console.log('\n[DEBUG] Exit handler already called, skipping duplicate');
    return;
  }
  globalThis._bunoshExitHandlerCalled = true;

  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${finalExitCode} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''}${tasksWarning ? ` | Warnings: ${tasksWarning}` : ''} | Time: ${totalTime}ms`);
});

function handleBunoshfileError(error, filePath) {
  banner();
  console.log();
  
  // Check for Babel parser syntax errors
  if (error.code === 'BABEL_PARSER_SYNTAX_ERROR' || 
      (error.reasonCode && error.loc) || 
      error.constructor.name === 'SyntaxError') {
    
    console.error(`❌ Syntax Error in ${path.basename(filePath)}:`);
    console.log();
    
    if (error.loc) {
      console.error(`   Line ${error.loc.line}, Column ${error.loc.column}:`);
      
      // Provide specific error messages based on reasonCode
      if (error.reasonCode === 'VarRedeclaration') {
        console.error(`   Variable redeclaration - '${error.message}' is already declared`);
      } else if (error.reasonCode && error.reasonCode.includes('Unexpected')) {
        console.error(`   ${error.reasonCode}: ${error.message || 'Unexpected token'}`);
      } else {
        console.error(`   ${error.message || error.reasonCode || 'Invalid syntax'}`);
      }
    } else {
      console.error(`   ${error.message || 'Invalid JavaScript syntax'}`);
    }
    
    console.log();
    console.log('💡 Common issues:');
    console.log('   • Missing semicolons or commas');
    console.log('   • Unclosed brackets, parentheses, or quotes'); 
    console.log('   • Invalid variable declarations');
    console.log('   • Mixing import/export with require/module.exports');
    console.log();
    console.log(`📝 Edit your Bunoshfile: ${color.blue('bunosh edit')}`);
    console.log(`🔧 Validate syntax: ${color.blue(`bun --check ${path.basename(filePath)}`)}`);
    
  } else if (error.message && error.message.includes('SyntaxError')) {
    console.error(`❌ JavaScript Syntax Error in ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message}`);
    console.log();
    console.log(`💡 Try running: ${color.blue('bun --check Bunoshfile.js')}`);
    console.log(`📝 Edit your Bunoshfile: ${color.blue('bunosh edit')}`);
    
  } else if (error.code === 'MODULE_NOT_FOUND' || 
             error.message?.includes('Cannot resolve') ||
             error.message?.includes('Could not resolve')) {
    console.error(`❌ Module Import Error in ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message}`);
    console.log();
    console.log('💡 Common solutions:');
    console.log(`   • Run: ${color.blue('bun install')}`);
    console.log('   • Check import paths are correct');
    console.log('   • Ensure dependencies are listed in package.json');
    
  } else {
    console.error(`❌ Error loading ${path.basename(filePath)}:`);
    console.log();
    console.error(`   ${error.message || error.toString()}`);
    
    // Add stack trace for debugging if available
    if (process.env.BUNOSH_DEBUG) {
      console.log();
      console.log('🐛 Debug stack trace:');
      console.log(error.stack || 'No stack trace available');
    }
    
    console.log();
    console.log('💡 Try:');
    console.log(`   • Check the file exists: ${color.blue(`ls -la ${path.basename(filePath)}`)}`);
    console.log(`   • Validate syntax: ${color.blue(`bun --check ${path.basename(filePath)}`)}`);
    console.log(`   • Edit the file: ${color.blue('bunosh edit')}`);
    console.log(`   • Run with debug: ${color.blue('BUNOSH_DEBUG=1 bunosh')}`);
  }
  
  console.log();
  process.exit(1);
}
