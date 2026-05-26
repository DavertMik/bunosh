import { BaseFormatter } from './base.js';

export class GitHubActionsFormatter extends BaseFormatter {
  format(taskName, status, taskType, extra = {}) {
    const taskTypePrefix = taskType ? `[${taskType}] ` : '';
    const fullTaskName = `${taskTypePrefix}${taskName}`;
    
    switch (status) {
      case 'start':
        return `::group::${fullTaskName}`;
        
      case 'finish':
        return `::endgroup::`;
        
      case 'error':
        const errorDetails = extra.error ? ` - ${extra.error}` : '';
        return `::endgroup::\n::error::❌ ${fullTaskName}${errorDetails}`;
        
      case 'warning':
        const warningDetails = extra.error ? ` - ${extra.error}` : '';
        return `::endgroup::\n::warning::⚠️ ${fullTaskName}${warningDetails}`;
        
      case 'output':
        return taskName;
        
      case 'info':
        return `::debug::${taskName}`;
        
      default:
        return taskName;
    }
  }

  formatOutput(line, isError = false) {
    return line;
  }

  static detect() {
    return process.env.GITHUB_ACTIONS === 'true';
  }
}