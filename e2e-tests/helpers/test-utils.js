/**
 * Utility functions for E2E tests
 */

/**
 * Strips ANSI color codes from a string
 * @param {string} str - The string to strip ANSI codes from
 * @returns {string} The string without ANSI codes
 */
export function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

/**
 * Strips ANSI codes from stdout and stderr of a test result
 * @param {object} result - The test result object
 * @returns {object} The result with ANSI codes stripped
 */
export function cleanTestOutput(result) {
  return {
    ...result,
    stdout: stripAnsiCodes(result.stdout),
    stderr: stripAnsiCodes(result.stderr)
  };
}