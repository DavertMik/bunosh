import { TaskResult, createTaskInfo, finishTaskInfo } from "../task.js";
import Printer from "../printer.js";

const isBun = typeof Bun !== 'undefined' && typeof Bun.spawn === 'function';

export default function shell(strings, ...values) {
  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || "");
  }, "");

  let envs = null;
  let cwd = null;

  const cmdPromise = new Promise(async (resolve, reject) => {
    const extraInfo = {};
    if (cwd) extraInfo.cwd = cwd;
    if (envs) extraInfo.env = envs;

    if (!isBun) {
      const { default: exec } = await import("./exec.js");
      let execPromise = exec(strings, ...values);
      if (envs) execPromise = execPromise.env(envs);
      if (cwd) execPromise = execPromise.cwd(cwd);
      const result = await execPromise;
      resolve(result);
      return;
    }

    const taskInfo = createTaskInfo(cmd);
    const printer = new Printer("shell", taskInfo.id);
    printer.start(cmd, extraInfo);

    try {
      const { $ } = await import("bun");
      
      let shell = $;
      
      if (cwd) {
        shell = shell.cwd(cwd);
      }
      
      if (envs) {
        shell = shell.env(envs);
      }

      let result;
      try {
        result = await shell(strings, ...values);
        
        const output = await result.text();
        
        printer.finish(cmd);
        finishTaskInfo(taskInfo, true, null, output.trim());
        resolve(TaskResult.success(output.trim()));
        return;
        
      } catch (shellError) {
        const isCommandNotFound = shellError.stderr && 
          (shellError.stderr.includes('command not found') || 
           shellError.stderr.includes('bun: command not found'));
        
        if (isCommandNotFound) {
          printer.finish(cmd);
          finishTaskInfo(taskInfo, true, null, "fallback to exec");
          
          const { default: exec } = await import("./exec.js");
          let execPromise = exec`${cmd}`;
          if (envs) execPromise = execPromise.env(envs);
          if (cwd) execPromise = execPromise.cwd(cwd);
          const result = await execPromise;
          resolve(result);
          return;
        }
        
        if (shellError.exitCode !== undefined) {
          const stderr = shellError.stderr || "";
          const stdout = shellError.stdout || "";
          const errorOutput = (stderr + stdout).trim() || `Command failed with exit code ${shellError.exitCode}`;
          
          if (errorOutput) {
            const lines = errorOutput.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                printer.output(line, true);
              }
            }
          }
          
          const error = new Error(`Exit code: ${shellError.exitCode}`);
          printer.error(cmd, null, { exitCode: shellError.exitCode });
          finishTaskInfo(taskInfo, false, error, errorOutput);
          resolve(TaskResult.fail(errorOutput));
          return;
        } else {
          throw shellError;
        }
      }
    } catch (error) {
      printer.error(cmd, error);
      finishTaskInfo(taskInfo, false, error, error.message);
      resolve(TaskResult.fail(error.message));
    }
  });

  cmdPromise.env = (newEnvs) => {
    envs = newEnvs;
    return cmdPromise;
  };

  cmdPromise.cwd = (newCwd) => {
    cwd = newCwd;
    return cmdPromise;
  };

  return cmdPromise;
}
