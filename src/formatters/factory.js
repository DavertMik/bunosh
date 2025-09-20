import { GitHubActionsFormatter } from './github-actions.js';
import { ConsoleFormatter } from './console.js';

const FORMATTERS = [
  GitHubActionsFormatter,
  ConsoleFormatter
];

// Global test formatter override
let testFormatterOverride = null;

export function createFormatter() {
  // Use test override if set
  if (testFormatterOverride) {
    return new testFormatterOverride();
  }
  
  // Check for explicit formatter override via environment variable
  if (process.env.BUNOSH_FORMATTER) {
    const requested = process.env.BUNOSH_FORMATTER.toLowerCase();
    switch (requested) {
      case 'console':
        return new ConsoleFormatter();
      case 'github-actions':
        return new GitHubActionsFormatter();
      default:
        console.warn(`Unknown BUNOSH_FORMATTER: ${requested}. Using auto-detection.`);
    }
  }
  
  for (const FormatterClass of FORMATTERS) {
    if (FormatterClass.detect && FormatterClass.detect()) {
      return new FormatterClass();
    }
  }
  
  return new ConsoleFormatter();
}

// Test utilities
export function setTestFormatter(FormatterClass) {
  testFormatterOverride = FormatterClass;
}

export function clearTestFormatter() {
  testFormatterOverride = null;
}