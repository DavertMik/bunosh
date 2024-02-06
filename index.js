import program from "./src/program";
import exec from "./src/tasks/exec";
import fetch from "./src/tasks/fetch";
import { task, stopOnFail, ignoreFail } from "./src/task";

export { program as bunosh };

export { exec, fetch, task, stopOnFail, ignoreFail};
export { exec as $ }

export function buildCmd(cmd) {
  return function(args) {
    return exec`${cmd} ${args}`
  }
}
