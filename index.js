import shell from "./src/tasks/shell.js";
// Deprecated: `exec` is an alias for `shell`, kept for backward compatibility.
const exec = shell;
import fetch from "./src/tasks/fetch.js";
import writeToFile from "./src/tasks/writeToFile.js";
import copyFile from "./src/tasks/copyFile.js";
import ai from "./src/tasks/ai.js";
import { ask, yell, say } from "./src/io.js";
import { task, tryTask, stopOnFail, ignoreFail, stopOnFailures, ignoreFailures, silence, prints, silent, TaskResult } from "./src/task.js";

export { exec, shell, fetch, writeToFile, copyFile, ai, ask, yell, say, task, tryTask, stopOnFail, ignoreFail, stopOnFailures, ignoreFailures, silence, prints, silent, TaskResult };

export function buildCmd(cmd) {
  return function (args) {
    return shell`${cmd} ${args}`;
  };
}

global.bunosh = {
  ask,
  yell,
  say,
  fetch,
  exec,
  shell,
  writeToFile,
  copyFile,
  ai,
  stopOnFail,
  ignoreFail,
  task,
  stopOnFailures,
  ignoreFailures,
  silence,
  prints,
  silent,
  TaskResult,
  buildCmd,
  $: shell,
};

export default global.bunosh;
