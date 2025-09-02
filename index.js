import exec from "./src/tasks/exec.js";
import shell from "./src/tasks/shell.js";
import fetch from "./src/tasks/fetch.js";
import writeToFile from "./src/tasks/writeToFile.js";
import copyFile from "./src/tasks/copyFile.js";
import ai from "./src/tasks/ai.js";
import { ask, yell, say } from "./src/io.js";
import { task, stopOnFail, ignoreFail } from "./src/task.js";

export { exec, shell, fetch, writeToFile, copyFile, ai, ask, yell, say, task, stopOnFail, ignoreFail };

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
  buildCmd,
  $: exec,
};

export default global.bunosh;
