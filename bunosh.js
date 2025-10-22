
// Set up global variables BEFORE any imports
globalThis._bunoshStartTime = Date.now();
globalThis._bunoshCommandCompleted = false;
globalThis._bunoshGlobalTasksExecuted = [];
globalThis._bunoshIgnoreFailuresMode = false;
globalThis._bunoshGlobalTaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success',
  WARNING: 'warning'
};

// Now import modules

import bunosh, { BUNOSHFILE, banner }  from "./src/program.js";
import { existsSync, readFileSync, statSync } from "fs";
import init from "./src/init.js";
import path from "path";
import { config } from "dotenv";

/**
 * Load environment variables from .env files following Bun's loading order
 * @param {string} bunoshfileDir - Directory containing the Bunoshfile
 * @param {string} customEnvFile - Optional custom env file path from --env-file option
 */
function loadEnvFiles(bunoshfileDir, customEnvFile = null) {
  if (customEnvFile) {
    // Load the specified env file
    const customEnvPath = path.isAbsolute(customEnvFile)
      ? customEnvFile
      : path.resolve(bunoshfileDir, customEnvFile);

    if (existsSync(customEnvPath)) {
      config({ path: customEnvPath });
    } else {
      console.warn(`Warning: Specified env file not found: ${customEnvPath}`);
    }
    return;
  }

  // Follow Bun's automatic loading order
  const envFiles = [
    '.env',
    '.env.production',
    '.env.development',
    '.env.test',
    '.env.local'
  ];

  envFiles.forEach(envFile => {
    const envPath = path.join(bunoshfileDir, envFile);
    if (existsSync(envPath)) {
      config({ path: envPath });
    }
  });
}

async function loadBunoshfiles(tasksFile) {
  const path = await import('path');
  const fs = await import('fs');
  
  // Get the directory and base name of the tasks file
  const dir = path.dirname(tasksFile);
  const baseName = path.basename(tasksFile, '.js');
  
  // Find all matching Bunoshfile variants
  const files = fs.readdirSync(dir);
  const bunoshFiles = files
    .filter(file => {
      // Match Bunoshfile.js, Bunoshfile.*.js
      const regex = new RegExp(`^${baseName}(\\.\\w+)?\\.js$`);
      return regex.test(file);
    })
    .sort(); // Ensure consistent order
  
  const allTasks = {};
  const allSources = {};
  
  for (const file of bunoshFiles) {
    const filePath = path.join(dir, file);
    try {
      // Extract namespace from filename
      let namespace = '';
      if (file !== `${baseName}.js`) {
        // Remove baseName and .js, then remove the leading dot
        namespace = file.slice(baseName.length, -3).substring(1);
      }
      
      const tasks = await import(filePath);
      const source = fs.readFileSync(filePath, 'utf-8');
      
      // Add namespace prefix to tasks if namespace exists
      if (namespace) {
        Object.keys(tasks).forEach(key => {
          if (typeof tasks[key] === 'function') {
            allTasks[`${namespace}:${key}`] = tasks[key];
            allSources[`${namespace}:${key}`] = { source, namespace, originalFnName: key };
          }
        });
      } else {
        // No namespace for the main Bunoshfile
        Object.keys(tasks).forEach(key => {
          if (typeof tasks[key] === 'function') {
            allTasks[key] = tasks[key];
            allSources[key] = { source, namespace: '', originalFnName: key };
          }
        });
      }
    } catch (error) {
      console.warn(`Warning: Could not load ${file}:`, error.message);
    }
  }
  
  return { tasks: allTasks, sources: allSources };
}

async function main() {

  // Parse --bunoshfile flag or BUNOSHFILE env var before importing tasks
  const bunoshfileIndex = process.argv.indexOf('--bunoshfile');
  let customBunoshfile = null;

  if (bunoshfileIndex !== -1 && bunoshfileIndex + 1 < process.argv.length) {
    customBunoshfile = process.argv[bunoshfileIndex + 1];
    // Remove the flag and its value from process.argv so it doesn't interfere with command parsing
    process.argv.splice(bunoshfileIndex, 2);
  } else if (process.env.BUNOSHFILE) {
    customBunoshfile = process.env.BUNOSHFILE;
  }

  // Parse --env-file flag
  const envFileIndex = process.argv.findIndex(arg => arg.startsWith('--env-file='));
  let customEnvFile = null;

  if (envFileIndex !== -1) {
    customEnvFile = process.argv[envFileIndex].split('=')[1];
    // Remove the flag from process.argv so it doesn't interfere with command parsing
    process.argv.splice(envFileIndex, 1);
  }

  // Check for -mcp flag first
  const mcpFlagIndex = process.argv.indexOf('-mcp');
  if (mcpFlagIndex !== -1) {
    // Remove the flag from process.argv
    process.argv.splice(mcpFlagIndex, 1);

    // Set environment variable to indicate MCP mode
    process.env.BUNOSH_MCP_MODE = 'true';

    // Import MCP server and start it
    const { createMcpServer, startMcpServer } = await import('./src/mcp-server.js');

    let tasksFile;
    let bunoshfileDir;
    if (customBunoshfile) {
      const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
      // If it's a directory, append the default BUNOSHFILE
      if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
        tasksFile = path.join(resolvedPath, BUNOSHFILE);
        bunoshfileDir = resolvedPath;
      } else {
        tasksFile = resolvedPath;
        bunoshfileDir = path.dirname(resolvedPath);
      }
    } else {
      tasksFile = path.join(process.cwd(), BUNOSHFILE);
      bunoshfileDir = process.cwd();
    }

    if (!existsSync(tasksFile)) {
      console.error('Bunoshfile not found for MCP mode');
      process.exit(1);
    }

    // Load environment files from the Bunoshfile directory
    loadEnvFiles(bunoshfileDir, customEnvFile);

    // Load tasks and sources
    const { tasks, sources } = await loadBunoshfiles(tasksFile);

    // Create and start MCP server
    const server = createMcpServer(tasks, sources);
    await startMcpServer(server);

    return; // Exit early for MCP mode
  }

  let tasksFile;
  let bunoshfileDir;
  if (customBunoshfile) {
    const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
    // If it's a directory, append the default BUNOSHFILE
    if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      tasksFile = path.join(resolvedPath, BUNOSHFILE);
      bunoshfileDir = resolvedPath;
      // Change working directory to the bunoshfile directory
      process.chdir(resolvedPath);
    } else {
      tasksFile = resolvedPath;
      bunoshfileDir = path.dirname(resolvedPath);
      // Change working directory to the bunoshfile's directory
      process.chdir(path.dirname(resolvedPath));
    }
  } else {
    tasksFile = path.join(process.cwd(), BUNOSHFILE);
    bunoshfileDir = process.cwd();
  }

  // Load environment files from the Bunoshfile directory
  loadEnvFiles(bunoshfileDir, customEnvFile);

  // Handle -e flag for executing JavaScript code
  const eFlagIndex = process.argv.indexOf('-e');
  if (eFlagIndex !== -1) {
    (async () => {
      let jsCode = '';
      
      // Check if code is provided as argument
      if (eFlagIndex + 1 < process.argv.length && !process.argv[eFlagIndex + 1].startsWith('-')) {
        jsCode = process.argv[eFlagIndex + 1];
      } else if (!process.stdin.isTTY) {
        // Read from stdin only if it's not a TTY (i.e., it's being piped)
        const chunks = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        jsCode = Buffer.concat(chunks).toString('utf8').trim();
      }
      
      if (!jsCode) {
        console.error('No JavaScript code provided');
        process.exit(1);
      }
      
      try {
        // Import bunosh globals before executing JavaScript
        await import('./index.js');
        
        // Make bunosh globals available to the function
        for (const [key, value] of Object.entries(global.bunosh)) {
          if (typeof value === 'function') {
            globalThis[key] = value;
          }
        }
        
        // Execute the JavaScript code with bunosh globals available
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const func = new AsyncFunction(jsCode);
        await func();
        process.exit(0);
      } catch (error) {
        console.error('Error executing JavaScript:', error.message);
        process.exit(1);
      }
    })();
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

  await import('./index.js');

// Load all Bunoshfile variants
const { tasks, sources } = await loadBunoshfiles(tasksFile);
await bunosh(tasks, sources);
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
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('exit', (code) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  if (globalThis._bunoshInAskOperation && code === 0) {
    return;
  }

  const tasksExecuted = globalThis._bunoshGlobalTasksExecuted || [];
  const TaskStatus = globalThis._bunoshGlobalTaskStatus || { FAIL: 'fail', WARNING: 'warning' };

  const totalTime = Date.now() - globalThis._bunoshStartTime || 0;
  const tasksFailed = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.FAIL).length;
  const tasksWarning = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.WARNING).length;

  const commandArgs = process.argv.slice(2);

  // Test environment detection
  const isTestEnvironment = process.env.NODE_ENV === 'test' ||
                            (typeof jest !== 'undefined' && jest.isRunning) ||
                            (process.env.VITEST_WORKER_ID !== undefined) ||
                            commandArgs.some(arg => {
                              const lowerArg = arg.toLowerCase();
                              return lowerArg.includes('vitest') ||
                                     lowerArg.includes('jest') ||
                                     lowerArg === '--test' ||
                                     lowerArg.startsWith('test:');
                            });

  const ignoreFailuresMode = globalThis._bunoshIgnoreFailuresMode || false;

  if (tasksFailed > 0 && !isTestEnvironment && !ignoreFailuresMode) {
    process.exitCode = 1;
  }

  const finalExitCode = (tasksFailed > 0 && !isTestEnvironment && !ignoreFailuresMode) ? 1 : code;
  const success = finalExitCode === 0;

  if (globalThis._bunoshExitHandlerCalled) {
    console.log('\n[DEBUG] Exit handler already called, skipping duplicate');
    return;
  }
  globalThis._bunoshExitHandlerCalled = true;

  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${finalExitCode} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''}${tasksWarning ? ` | Warnings: ${tasksWarning}` : ''} | Time: ${totalTime}ms`);
});

function handleBunoshfileError(error, filePath) {
  // Don't show banner for errors - it interferes with error visibility
  
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
