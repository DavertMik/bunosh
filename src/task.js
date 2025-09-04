import { AsyncLocalStorage } from 'async_hooks';
import Printer from './printer.js';

export const TaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success',
  WARNING: 'warning'
};

export const tasksExecuted = [];
export const runningTasks = new Map();

let taskCounter = 0;
let stopFailToggle = true;
let globalSilenceMode = false;
const asyncLocalStorage = new AsyncLocalStorage();


export function stopOnFail(enable = true) {
  stopFailToggle = enable;
}

export function ignoreFail(enable = true) {
  stopFailToggle = !enable;
}

// Global failure mode control
// true = stop on failures (exit with code 1), false = continue on failures
let stopOnFailuresMode = false;

export function ignoreFailures() {
  stopOnFailuresMode = false;
}

export function stopOnFailures() {
  stopOnFailuresMode = true;
}

export function silence() {
  globalSilenceMode = true;
}

export function prints() {
  globalSilenceMode = false;
}

const startTime = Date.now();

process.on('exit', (code) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  const totalTime = Date.now() - startTime;
  const tasksFailed = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.FAIL).length;
  const tasksWarning = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.WARNING).length;
  
  // Check if we're in test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test' ||
                            typeof Bun?.jest !== 'undefined' ||
                            process.argv.some(arg => arg.includes('vitest') || arg.includes('jest') || arg.includes('--test') || arg.includes('test:'));
  
  // Set exit code to 1 if any tasks failed AND we're not in ignoreFailures mode AND not in test environment
  // Note: if stopOnFailuresMode is true, we would have already exited immediately
  if (tasksFailed > 0 && !stopOnFailuresMode && !isTestEnvironment) {
    process.exitCode = 1;
  }
  
  const finalExitCode = (tasksFailed > 0 && !stopOnFailuresMode && !isTestEnvironment) ? 1 : code;
  const success = finalExitCode === 0;

  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${finalExitCode} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''}${tasksWarning ? ` | Warnings: ${tasksWarning}` : ''} | Time: ${totalTime}ms`);
});

export function getRunningTaskCount() {
  return runningTasks.size;
}

export function getCurrentTaskId() {
  return asyncLocalStorage.getStore();
}

export function getTaskPrefix(taskId) {
  const taskNumber = Array.from(runningTasks.keys()).indexOf(taskId) + 1;
  return getRunningTaskCount() > 1 ? `❰${taskNumber}❱` : '';
}

export function createTaskInfo(name) {
  const taskInfo = new TaskInfo(name, Date.now(), TaskStatus.RUNNING);
  runningTasks.set(taskInfo.id, taskInfo);
  tasksExecuted.push(taskInfo);
  return taskInfo;
}

export function finishTaskInfo(taskInfo, success = true, error = null, output = null) {
  const endTime = Date.now();
  const duration = endTime - taskInfo.startTime;

  taskInfo.status = success ? TaskStatus.SUCCESS : TaskStatus.FAIL;
  taskInfo.duration = duration;
  taskInfo.result = {
    status: success ? TaskStatus.SUCCESS : TaskStatus.FAIL,
    output: error?.message || output || null
  };

  runningTasks.delete(taskInfo.id);
}

export class TaskInfo {
  constructor(name, startTime, status) {
    this.id = `task-${++taskCounter}-${Math.random().toString(36).substring(7)}`;
    this.name = name;
    this.startTime = startTime;
    this.status = status;
  }
}

export async function tryTask(name, fn, isSilent = false) {
  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const taskInfo = new TaskInfo(name, Date.now(), TaskStatus.RUNNING);

  tasksExecuted.push(taskInfo);
  runningTasks.set(taskInfo.id, taskInfo);

  const shouldPrint = !globalSilenceMode && !isSilent;
  const printer = new Printer('task', taskInfo.id);
  if (shouldPrint) printer.start(name);

  try {
    const result = await asyncLocalStorage.run(taskInfo.id, async () => {
      return await Promise.resolve(fn());
    });

    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.SUCCESS;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.SUCCESS, output: result };

    if (shouldPrint) printer.finish(name);
    runningTasks.delete(taskInfo.id);

    return true;
  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.WARNING;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.WARNING, output: err.message };

    if (shouldPrint) printer.warning(name, err);
    runningTasks.delete(taskInfo.id);

    return false;
  }
}

export async function task(name, fn, isSilent = false) {
  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const taskInfo = new TaskInfo(name, Date.now(), TaskStatus.RUNNING);

  tasksExecuted.push(taskInfo);
  runningTasks.set(taskInfo.id, taskInfo);

  const shouldPrint = !globalSilenceMode && !isSilent;
  const printer = new Printer('task', taskInfo.id);
  if (shouldPrint) printer.start(name);

  try {
    const result = await asyncLocalStorage.run(taskInfo.id, async () => {
      return await Promise.resolve(fn());
    });

    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.SUCCESS;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.SUCCESS, output: result };

    if (shouldPrint) printer.finish(name);
    runningTasks.delete(taskInfo.id);

    return result;
  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.FAIL;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.FAIL, output: err.message };

    if (shouldPrint) printer.error(name, err);
    runningTasks.delete(taskInfo.id);

    // Don't exit during testing
    const isTestEnvironment = process.env.NODE_ENV === 'test' ||
                              typeof Bun?.jest !== 'undefined' ||
                              process.argv.some(arg => arg.includes('vitest') || arg.includes('jest') || arg.includes('--test') || arg.includes('test:'));

    // Exit immediately if stopOnFailures mode is enabled
    if (stopOnFailuresMode && !isTestEnvironment) {
      process.exit(1);
    }
    
    // Also exit if stopFailToggle is enabled (legacy behavior)
    if (stopFailToggle && !isTestEnvironment) {
      process.exit(1);
    }

    throw err;
  }
}

export class SilentTaskWrapper {
  constructor() {
    this.silent = true;
  }

  async try(name, fn) {
    if (!fn) {
      fn = name;
      name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
    }
    return await tryTask(name, fn, true);
  }

  async task(name, fn) {
    if (!fn) {
      fn = name;
      name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
    }
    return await task(name, fn, true);
  }
}

export function silent() {
  return new SilentTaskWrapper();
}

export class TaskResult {
  constructor({ status, output }) {
    this.status = status;
    this.output = output;
  }

  get hasFailed() {
    return this.status === TaskStatus.FAIL;
  }

  get hasSucceeded() {
    return this.status === TaskStatus.SUCCESS;
  }

  get hasWarning() {
    return this.status === TaskStatus.WARNING;
  }

  static fail(output = null) {
    return new TaskResult({ status: TaskStatus.FAIL, output });
  }

  static success(output = null) {
    return new TaskResult({ status: TaskStatus.SUCCESS, output });
  }

  static warning(output = null) {
    return new TaskResult({ status: TaskStatus.WARNING, output });
  }
}
