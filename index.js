import exec from "./src/tasks/exec";
import fetch from "./src/tasks/fetch";
import writeToFile from "./src/tasks/writeToFile";
import copyFile from "./src/tasks/copyFile";
import { ask, yell, say } from "./src/io";
import { task, stopOnFail, ignoreFail } from "./src/task";

export { exec, fetch, writeToFile, copyFile, ask, yell, say, task, stopOnFail, ignoreFail };


export function buildCmd(cmd) {
  return function(args) {
    return exec`${cmd} ${args}`
  }
}

global.bunosh = {
  ask, yell, say,
  fetch,
  exec,
  writeToFile,
  copyFile,
  stopOnFail,
  ignoreFail,
  task,
  buildCmd,
  $: exec,
}

export default global.bunosh;
