import chalk from 'chalk';
import { BaseFormatter } from './base.js';

const STATUS_CONFIG = {
  start: { icon: '▶', color: 'blue' },
  finish: { icon: '✔', color: 'green' },
  error: { icon: '✗', color: 'red' },
  warning: { icon: '⚠', color: 'yellow' },
  output: { icon: ' ', color: 'white' },
  info: { icon: ' ', color: 'dim' }
};

export class ConsoleFormatter extends BaseFormatter {
  shouldDelayStart() {
    return false;
  }
  format(taskName, status, taskType, extra = {}) {
    const config = STATUS_CONFIG[status];
    if (!config) {
      throw new Error(`Unknown status: ${status}. Valid statuses: ${Object.keys(STATUS_CONFIG).join(', ')}`);
    }

    const icon = chalk[config.color](config.icon);
    const taskTypeFormatted = taskType ? chalk.bold(taskType) + ' ' : '';
    const taskNameFormatted = chalk.yellow(taskName);

    const extraParts = [];
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (key === 'duration') {
          extraParts.push(chalk.dim(`${value}ms`));
        } else if (key === 'error') {
          extraParts.push(chalk.dim(value));
        } else if (key === 'status') {
          extraParts.push(chalk.dim(value));
        } else if (key === 'exitCode') {
          extraParts.push(chalk.dim(`exit code: ${value}`));
        } else {
          extraParts.push(chalk.dim(`${key}: ${value}`));
        }
      }
    });

    const terminalWidth = process.stdout.columns || 100;
    let leftContent = `${icon} ${taskTypeFormatted}${taskNameFormatted}`;
    let rightContent = '';

    if (extraParts.length > 0) {
      rightContent = `(${extraParts.join(', ')})`;
    }

    const leftLength = this._stripAnsi(leftContent).length;
    const rightLength = this._stripAnsi(rightContent).length;
    const padding = ' '.repeat(Math.max(1, terminalWidth - leftLength - rightLength));

    let line = leftContent + padding + rightContent;

    if (icon.trim()) {
      line = chalk.bgGray(line);
    }

    let result = line;
    if (status === 'error' && extra.error) {
      result += '\n' + chalk.red('  Error:') + ' ' + extra.error;
    }
    if (status === 'finish' || status === 'error') {
      result += '\n';
    }

    return result;
  }

  formatOutput(line, isError = false) {
    if (!line.trim()) return '';
    return isError ? chalk.red(line) : line;
  }

  _stripAnsi(str) {
    return str.replace(/\u001b\[[0-9;]*m/g, '');
  }

  static detect() {
    return !process.env.CI;
  }
}
