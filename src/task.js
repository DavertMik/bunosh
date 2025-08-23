import chalk from 'chalk';
import Printer from './printer.js';

export const TaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];

let taskCounter = 0;
let stopFailToggle = true;

export function registerTaskExecution(name, success = true, error = null) {
  const taskInfo = {
    id: `task-${++taskCounter}-${Math.random().toString(36).substring(7)}`,
    name,
    startTime: Date.now(),
    status: success ? TaskStatus.SUCCESS : TaskStatus.FAIL,
    result: { status: success ? TaskStatus.SUCCESS : TaskStatus.FAIL, output: error?.message || null }
  };
  
  tasksExecuted.push(taskInfo);
}

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

export async function task(name, fn) {
  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const taskInfo = {
    id: `task-${++taskCounter}-${Math.random().toString(36).substring(7)}`,
    name,
    startTime: Date.now(),
    status: TaskStatus.RUNNING
  };
  
  tasksExecuted.push(taskInfo);

  const printer = new Printer('task');
  printer.start(name);

  try {
    const result = await Promise.resolve(fn());
    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;
    
    taskInfo.status = TaskStatus.SUCCESS;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.SUCCESS, output: result };
    
    printer.finish(name);
    
    return result;
  } catch (err) {
    const endTime = Date.now();
    const duration = endTime - taskInfo.startTime;
    
    taskInfo.status = TaskStatus.FAIL;
    taskInfo.duration = duration;
    taskInfo.result = { status: TaskStatus.FAIL, output: err.message };
    
    printer.error(name, err);
    
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

  static fail(output = null) {
    return new TaskResult({ status: TaskStatus.FAIL, output });
  }

  static success(output = null) {
    return new TaskResult({ status: TaskStatus.SUCCESS, output });
  }
}