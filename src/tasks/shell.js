import { TaskResult, createTaskInfo, finishTaskInfo } from "../task.js";
import Printer from "../printer.js";

const isBun = typeof Bun !== "undefined";

export default function shell(strings, ...values) {
  const script = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || "");
  }, "");

  let envs = null;
  let cwd = null;

  const scriptPromise = new Promise(async (resolve, reject) => {
    const extraInfo = {};
    if (cwd) extraInfo.cwd = cwd;
    if (envs) extraInfo.env = envs;

    const taskInfo = createTaskInfo(script);
    const printer = new Printer("shell", taskInfo.id);
    printer.start(script, extraInfo);

    try {
      if (global.disableBunForTesting || !isBun) {
        // Fall back to exec task in Node.js mode
        const { default: exec } = await import("./exec.js");
        let execPromise = exec`${script}`;
        if (envs) execPromise = execPromise.env(envs);
        if (cwd) execPromise = execPromise.cwd(cwd);
        const result = await execPromise;
        finishTaskInfo(taskInfo, result.hasSucceeded, null, result.output);
        resolve(result);
        return;
      }

      // Bun Shell implementation - fallback to exec for now due to environment issues
      // TODO: Fix Bun Shell built-in commands in task system context
      const { default: exec } = await import("./exec.js");
      let execPromise = exec`${script}`;
      if (envs) execPromise = execPromise.env(envs);
      if (cwd) execPromise = execPromise.cwd(cwd);
      const result = await execPromise;
      finishTaskInfo(taskInfo, result.hasSucceeded, null, result.output);
      resolve(result);
    } catch (error) {
      printer.error(script, error);
      finishTaskInfo(taskInfo, false, error, error.message);
      resolve(TaskResult.fail(error.message));
    }
  });

  scriptPromise.env = (newEnvs) => {
    envs = newEnvs;
    return scriptPromise;
  };

  scriptPromise.cwd = (newCwd) => {
    cwd = newCwd;
    return scriptPromise;
  };

  return scriptPromise;
}
