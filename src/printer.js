import { createFormatter } from './formatters/factory.js';

export class Printer {
  constructor(taskType) {
    this.taskType = taskType;
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

    const output = this.formatter.format(taskName, status, this.taskType, extra);
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

  output(line, isError = false) {
    if (!line.trim()) return;
    
    const formattedLine = this.formatter.formatOutput(line, isError);
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