import { BaseFormatter } from './base.js';

export class GitHubActionsFormatter extends BaseFormatter {
  format(taskName, status, taskType, extra = {}) {
    const taskTypePrefix = taskType ? `[${taskType}] ` : '';
    const fullTaskName = `${taskTypePrefix}${taskName}`;
    
    switch (status) {
      case 'start':
        return `::group::${fullTaskName}`;
        
      case 'finish':
        const duration = extra.duration ? `${extra.duration}ms` : '';
        const extraInfo = Object.entries(extra)
          .filter(([k, v]) => v !== null && v !== undefined && k !== 'duration')
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
        const details = [duration, extraInfo].filter(Boolean).join(', ');
        return `::endgroup::\n::notice::✅ ${fullTaskName}${details ? ` (${details})` : ''}`;
        
      case 'error':
        const errorDetails = extra.error ? ` - ${extra.error}` : '';
        return `::endgroup::\n::error::❌ ${fullTaskName}${errorDetails}`;
        
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