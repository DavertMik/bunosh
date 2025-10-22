import { AsyncLocalStorage } from 'async_hooks';
import Printer from './printer.js';

// Use global objects created in bunosh.js
export const TaskStatus = globalThis._bunoshGlobalTaskStatus || {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success',
  WARNING: 'warning'
};

// Initialize local array and also keep global synced
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
let stopOnFailuresMode = false;
let ignoreFailuresMode = false;

export function ignoreFailures() {
  stopOnFailuresMode = false;
  ignoreFailuresMode = true;
  globalThis._bunoshIgnoreFailuresMode = true;
}

export function stopOnFailures() {
  stopOnFailuresMode = true;
  ignoreFailuresMode = false;
  globalThis._bunoshIgnoreFailuresMode = false;
}

export function getIgnoreFailuresMode() {
  return ignoreFailuresMode;
}

export function silence() {
  globalSilenceMode = true;
}

export function prints() {
  globalSilenceMode = false;
}

export function getRunningTaskCount() {
  // Only count top-level tasks (tasks without a parent)
  return Array.from(runningTasks.values()).filter(task => !task.parentId).length;
}

export function getCurrentTaskId() {
  return asyncLocalStorage.getStore();
}

export function getTaskPrefix(taskId) {
  const taskInfo = runningTasks.get(taskId);
  if (!taskInfo) return '';

  // Only show prefixes for top-level tasks when there are multiple top-level tasks
  if (taskInfo.parentId) {
    // This is a child task, never show prefix
    return '';
  }

  // For top-level tasks, calculate position among other top-level tasks
  const topLevelTasks = Array.from(runningTasks.values()).filter(task => !task.parentId);
  const taskNumber = topLevelTasks.findIndex(task => task.id === taskId) + 1;
  return getRunningTaskCount() > 1 ? `❰${taskNumber}❱` : '';
}


export function createTaskInfo(name, parentId = null) {
  const taskInfo = new TaskInfo(name, Date.now(), TaskStatus.RUNNING, parentId);
  runningTasks.set(taskInfo.id, taskInfo);
  tasksExecuted.push(taskInfo);

  // Also add to global array for exit handler
  if (globalThis._bunoshGlobalTasksExecuted) {
    globalThis._bunoshGlobalTasksExecuted.push(taskInfo);
  }

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
  constructor(name, startTime, status, parentId = null) {
    this.id = `task-${++taskCounter}-${Math.random().toString(36).substring(7)}`;
    this.name = name;
    this.startTime = startTime;
    this.status = status;
    this.parentId = parentId;
  }
}

export async function tryTask(name, fn, isSilent = false) {
  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const taskInfo = createTaskInfo(name);

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

  const taskInfo = createTaskInfo(name);

  const shouldPrint = !globalSilenceMode && !isSilent;
  const printer = new Printer('task', taskInfo.id);
  if (shouldPrint) printer.start(name);

  try {
    const result = await asyncLocalStorage.run(taskInfo.id, async () => {
      return await Promise.resolve(fn());
    });

    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    // Check if result is a TaskResult instance
    if (result && result.constructor && result.constructor.name === 'TaskResult') {
      return result;
    }

    taskInfo.status = TaskStatus.SUCCESS;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.SUCCESS, output: result };

    printer.finish(name);
    runningTasks.delete(taskInfo.id);

    return TaskResult.success(result, { taskType: 'task' });
  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.FAIL;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.FAIL, output: err.message };

    printer.error(name, err);
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
    
    return TaskResult.fail(err.message, { taskType: 'task', error: err });
  }
}

// Add try method to task function
task.try = tryTask;


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
  constructor({ status, output, metadata = {} }) {
    this.status = status;
    this.output = output;
    this._metadata = metadata;
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

  async json() {
    const taskType = this._metadata.taskType || 'unknown';
    
    switch (taskType) {
      case 'fetch':
        // For fetch tasks, parse the response body as JSON
        if (this._metadata.response) {
          try {
            return await this._metadata.response.json();
          } catch (error) {
            throw new Error(`Failed to parse fetch response as JSON: ${error.message}`);
          }
        } else if (typeof this.output === 'string') {
          try {
            return JSON.parse(this.output);
          } catch (error) {
            throw new Error(`Failed to parse fetch output as JSON: ${error.message}`);
          }
        }
        throw new Error('No JSON data available from fetch task');

      case 'exec':
      case 'shell':
        // For exec/shell tasks, return structured output
        const lines = this.output ? this.output.split('\n').filter(line => line.trim()) : [];
        return {
          stdout: this._metadata.stdout || this.output || '',
          stderr: this._metadata.stderr || '',
          exitCode: this._metadata.exitCode || (this.hasFailed ? 1 : 0),
          lines
        };

      case 'ai':
        // For AI tasks, return the structured output if available
        if (typeof this.output === 'object') {
          return this.output;
        } else if (typeof this.output === 'string') {
          try {
            return JSON.parse(this.output);
          } catch (error) {
            // If it's not JSON, return as text property
            return { text: this.output };
          }
        }
        return { text: this.output || '' };

      default:
        // For unknown task types, try to parse output as JSON or return as text
        if (typeof this.output === 'object') {
          return this.output;
        } else if (typeof this.output === 'string') {
          try {
            return JSON.parse(this.output);
          } catch (error) {
            return { text: this.output };
          }
        }
        return { text: this.output || '' };
    }
  }

  static fail(output = null, metadata = {}) {
    return new TaskResult({ status: TaskStatus.FAIL, output, metadata });
  }

  static success(output = null, metadata = {}) {
    return new TaskResult({ status: TaskStatus.SUCCESS, output, metadata });
  }

  static warning(output = null, metadata = {}) {
    return new TaskResult({ status: TaskStatus.WARNING, output, metadata });
  }
}
