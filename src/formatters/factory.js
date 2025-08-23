import { GitHubActionsFormatter } from './github-actions.js';
import { ConsoleFormatter } from './console.js';

const FORMATTERS = [
  GitHubActionsFormatter,
  ConsoleFormatter
];

export function createFormatter() {
  for (const FormatterClass of FORMATTERS) {
    if (FormatterClass.detect && FormatterClass.detect()) {
      return new FormatterClass();
    }
  }
  
  return new ConsoleFormatter();
}