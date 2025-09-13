import chalk from 'chalk';
import { createFormatter } from './formatters/factory.js';
import { getTaskPrefix, runningTasks } from './task.js';

export class Printer {
  constructor(taskType, taskId = null) {
    this.taskType = taskType;
    this.taskId = taskId;
    this.startTime = null;
    this.startTimeout = null;
    this.hasStarted = false;
    this.formatter = createFormatter();
  }

  print(taskName, status, extra = {}) {
    if (status === 'start' && !this.startTime) {
      this.startTime = Date.now();
    }

    if ((status === 'finish' || status === 'error') && this.startTime) {
      extra.duration = Date.now() - this.startTime;
    }

    // Get task info to check for parent task
    let displayTaskName = taskName;
    if (this.taskId) {
      const taskInfo = runningTasks.get(this.taskId);
      if (taskInfo && taskInfo.parentId) {
        const parentTask = runningTasks.get(taskInfo.parentId);
        if (parentTask) {
          displayTaskName = `${parentTask.name} > ${taskName}`;
        }
      }
    }

    // Add task prefix for parallel tasks
    const prefix = this.taskId ? getTaskPrefix(this.taskId) : '';
    const prefixedTaskName = prefix ? `${prefix} ${displayTaskName}` : displayTaskName;

    const output = this.formatter.format(prefixedTaskName, status, this.taskType, extra);
    if (output) {
      console.log(output);
    }
  }

  start(taskName, extra = {}) {
    this.startTime = Date.now();
    const delay = this.formatter.getStartDelay ? this.formatter.getStartDelay() : 50;

    if (this.formatter.shouldDelayStart && this.formatter.shouldDelayStart()) {
      this.startTimeout = setTimeout(() => {
        this.hasStarted = true;
        this.print(taskName, 'start', extra);
      }, delay);
    } else {
      this.hasStarted = true;
      this.print(taskName, 'start', extra);
    }
  }

  finish(taskName, extra = {}) {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    this.print(taskName, 'finish', extra);
  }

  error(taskName, error = null, extra = {}) {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (error) {
      extra.error = typeof error === 'string' ? error : error.message;
    }
    this.print(taskName, 'error', extra);
  }

  warning(taskName, error = null, extra = {}) {
    if (this.startTimeout) {
      clearTimeout(this.startTimeout);
      this.startTimeout = null;
    }
    if (error) {
      extra.error = typeof error === 'string' ? error : error.message;
    }
    this.print(taskName, 'warning', extra);
  }

  output(line, isError = false) {
    if (!line.trim()) return;

    // Add task prefix for parallel tasks on output lines
    const prefix = this.taskId ? getTaskPrefix(this.taskId) : '';
    const prefixedLine = prefix ? `${chalk.gray.dim(prefix)} ${line}` : line;

    const formattedLine = this.formatter.formatOutput(prefixedLine, isError);
    if (formattedLine) {
      console.log(formattedLine);
    }
  }

  info(message) {
    this.print(message, 'info');
  }

  static log(taskName, status, extra = {}) {
    const printer = new Printer('');
    printer.print(taskName, status, extra);
  }
}

export default Printer;
