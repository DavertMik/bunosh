import exec from "./src/tasks/exec.js";
import shell from "./src/tasks/shell.js";
import fetch from "./src/tasks/fetch.js";
import writeToFile from "./src/tasks/writeToFile.js";
import copyFile from "./src/tasks/copyFile.js";
import ai from "./src/tasks/ai.js";
import { ask, yell, say } from "./src/io.js";
import { task, tryTask, stopOnFail, ignoreFail, stopOnFailures, ignoreFailures, silence, prints, silent } from "./src/task.js";

export { exec, shell, fetch, writeToFile, copyFile, ai, ask, yell, say, task, tryTask, stopOnFail, ignoreFail, stopOnFailures, ignoreFailures, silence, prints, silent };

export function buildCmd(cmd) {
  return function (args) {
    return exec`${cmd} ${args}`;
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
  try: tryTask,
  stopOnFailures,
  ignoreFailures,
  silence,
  prints,
  silent,
  buildCmd,
  $: exec,
};

export default global.bunosh;
