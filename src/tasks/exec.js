// Deprecated: `exec` is now an alias for `shell`.
// Use `shell` (or `$`) instead. This module is kept for backward compatibility.
import shell from './shell.js';

export default function exec(strings, ...values) {
  return shell(strings, ...values);
}
