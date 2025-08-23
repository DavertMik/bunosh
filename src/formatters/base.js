export class BaseFormatter {
  format(taskName, status, taskType, extra = {}) {
    throw new Error('format method must be implemented by subclass');
  }

  formatOutput(line, isError = false) {
    return line;
  }

  shouldDelayStart() {
    return true;
  }

  getStartDelay() {
    return 50;
  }
}