import exec from "./src/tasks/exec";
import fetch from "./src/tasks/fetch";
import writeToFile from "./src/tasks/writeToFile";
import copyFile from "./src/tasks/copyFile";
import { ask, yell, say } from "./src/io";
import { task, stopOnFail, ignoreFail } from "./src/task";

// export { program as bunosh };


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
