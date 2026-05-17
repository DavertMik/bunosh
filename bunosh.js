#!/usr/bin/env bun

process.removeAllListeners('warning');
process.on('warning', () => {});

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

import bunosh, { BUNOSHFILE, banner }  from "./src/program.js";
import { existsSync, readFileSync, statSync } from "fs";
import init from "./src/init.js";
import path from "path";
import { config } from "dotenv";
import { formatError } from "./src/error-formatter.js";
import color from "chalk";

function loadEnvFiles(bunoshfileDir, customEnvFile = null) {
  if (customEnvFile) {
    const customEnvPath = path.isAbsolute(customEnvFile)
      ? customEnvFile
      : path.resolve(bunoshfileDir, customEnvFile);

    if (existsSync(customEnvPath)) {
      config({ path: customEnvPath, quiet: true });
    } else {
      console.warn(`Warning: Specified env file not found: ${customEnvPath}`);
    }
    return;
  }

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
      config({ path: envPath, quiet: true });
    }
  });
}

async function loadBunoshfiles(tasksFile) {
  const path = await import('path');
  const fs = await import('fs');

  const dir = path.dirname(tasksFile);
  const baseName = path.basename(tasksFile, '.js');

  const files = fs.readdirSync(dir);
  const bunoshFiles = files
    .filter(file => {
      const regex = new RegExp(`^${baseName}(\\.\\w+)?\\.js$`);
      return regex.test(file);
    })
    .sort();

  const allTasks = {};
  const allSources = {};

  for (const file of bunoshFiles) {
    const filePath = path.join(dir, file);
    try {
      let namespace = '';
      if (file !== `${baseName}.js`) {
        namespace = file.slice(baseName.length, -3).substring(1);
      }

      const tasks = await import(filePath);
      const source = fs.readFileSync(filePath, 'utf-8');

      if (namespace) {
        Object.keys(tasks).forEach(key => {
          if (typeof tasks[key] === 'function') {
            allTasks[`${namespace}:${key}`] = tasks[key];
            allSources[`${namespace}:${key}`] = { source, namespace, originalFnName: key };
          }
        });
      } else {
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

  const bunoshfileIndex = process.argv.indexOf('--bunoshfile');
  let customBunoshfile = null;

  if (bunoshfileIndex !== -1 && bunoshfileIndex + 1 < process.argv.length) {
    customBunoshfile = process.argv[bunoshfileIndex + 1];
    process.argv.splice(bunoshfileIndex, 2);
  } else if (process.env.BUNOSHFILE) {
    customBunoshfile = process.env.BUNOSHFILE;
  }

  const envFileIndex = process.argv.findIndex(arg => arg.startsWith('--env-file='));
  let customEnvFile = null;

  if (envFileIndex !== -1) {
    customEnvFile = process.argv[envFileIndex].split('=')[1];
    process.argv.splice(envFileIndex, 1);
  }

  let tasksFile;
  let bunoshfileDir;
  if (customBunoshfile) {
    const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
    if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      tasksFile = path.join(resolvedPath, BUNOSHFILE);
      bunoshfileDir = resolvedPath;
      process.chdir(resolvedPath);
    } else {
      tasksFile = resolvedPath;
      bunoshfileDir = path.dirname(resolvedPath);
      process.chdir(path.dirname(resolvedPath));
    }
  } else {
    tasksFile = path.join(process.cwd(), BUNOSHFILE);
    bunoshfileDir = process.cwd();
  }

  loadEnvFiles(bunoshfileDir, customEnvFile);

  const eFlagIndex = process.argv.indexOf('-e');
  if (eFlagIndex !== -1) {
    (async () => {
      let jsCode = '';

      if (eFlagIndex + 1 < process.argv.length && !process.argv[eFlagIndex + 1].startsWith('-')) {
        jsCode = process.argv[eFlagIndex + 1];
      } else if (!process.stdin.isTTY) {
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
        await import('./index.js');

        for (const [key, value] of Object.entries(global.bunosh)) {
          if (typeof value === 'function') {
            globalThis[key] = value;
          }
        }

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

  const { tasks, sources } = await loadBunoshfiles(tasksFile);
  await bunosh(tasks, sources);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  if (reason instanceof Error) {
    console.error('\n' + formatError(reason));
  } else {
    console.error('\n' + color.red.bold('Unhandled Promise Rejection:'));
    console.error(reason);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  console.error('\n' + formatError(error));
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
    return;
  }
  globalThis._bunoshExitHandlerCalled = true;

  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${finalExitCode} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''}${tasksWarning ? ` | Warnings: ${tasksWarning}` : ''} | Time: ${totalTime}ms`);
});
