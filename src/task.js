import { AsyncLocalStorage } from 'async_hooks';
import Printer from './printer.js';

export const TaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];
export const runningTasks = new Map();

let taskCounter = 0;
let stopFailToggle = true;
const asyncLocalStorage = new AsyncLocalStorage();


export function stopOnFail(enable = true) {
  stopFailToggle = enable;
}

export function ignoreFail(enable = true) {
  stopFailToggle = !enable;
}

const startTime = Date.now();

process.on('exit', (code) => {
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  const totalTime = Date.now() - startTime;
  const success = code === 0;
  const tasksFailed = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.FAIL).length;

  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${code} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''} | Time: ${totalTime}ms`);
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

export async function task(name, fn) {
  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const taskInfo = new TaskInfo(name, Date.now(), TaskStatus.RUNNING);

  tasksExecuted.push(taskInfo);
  runningTasks.set(taskInfo.id, taskInfo);

  const printer = new Printer('task', taskInfo.id);
  printer.start(name);

  try {
    const result = await asyncLocalStorage.run(taskInfo.id, async () => {
      return await Promise.resolve(fn());
    });

    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;

    taskInfo.status = TaskStatus.SUCCESS;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.SUCCESS, output: result };

    printer.finish(name);
    runningTasks.delete(taskInfo.id);

    return result;
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
                              process.argv.some(arg => arg.includes('test'));

    if (stopFailToggle && !isTestEnvironment) {
      process.exit(1);
    }

    throw err;
  }
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

  static fail(output = null) {
    return new TaskResult({ status: TaskStatus.FAIL, output });
  }

  static success(output = null) {
    return new TaskResult({ status: TaskStatus.SUCCESS, output });
  }
}
