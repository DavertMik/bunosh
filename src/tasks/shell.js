import { TaskResult, createTaskInfo, finishTaskInfo } from "../task.js";
import Printer from "../printer.js";

const isBun = typeof Bun !== 'undefined' && typeof Bun.spawn === 'function';

export default function shell(strings, ...values) {
  let envs = null;
  let cwd = null;
  
  // Check if called as regular function instead of template literal
  if (!Array.isArray(strings)) {
    // If first argument is a string, treat it as the command
    if (typeof strings === 'string') {
      // For Bun shell, we need to create a template literal-like call
      // But since we can't, fall back to exec
      console.log('Note: shell() with string argument falls back to exec()');
      const cmdPromise = (async () => {
        const { default: exec } = await import("./exec.js");
        let execPromise = exec(strings);
        if (envs) execPromise = execPromise.env(envs);
        if (cwd) execPromise = execPromise.cwd(cwd);
        return execPromise;
      })();
      
      // Add .env and .cwd methods
      cmdPromise.env = (newEnvs) => {
        envs = newEnvs;
        return cmdPromise;
      };
      
      cmdPromise.cwd = (newCwd) => {
        cwd = newCwd;
        return cmdPromise;
      };
      
      return cmdPromise;
    } else {
      throw new Error('shell() must be called as a template literal: shell`command`');
    }
  }
  
  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || "");
  }, "");

  const cmdPromise = new Promise(async (resolve, reject) => {
    const extraInfo = {};
    if (cwd) extraInfo.cwd = cwd;
    if (envs) extraInfo.env = envs;

    if (!isBun) {
      const { default: exec } = await import("./exec.js");
      let execPromise = exec([cmd]);
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
        
        const metadata = {
          taskType: 'shell',
          exitCode: 0,
          stdout: output.trim(),
          stderr: ''
        };
        
        printer.finish(cmd);
        finishTaskInfo(taskInfo, true, null, output.trim());
        resolve(TaskResult.success(output.trim(), metadata));
        return;
        
      } catch (shellError) {
        const isCommandNotFound = shellError.stderr && 
          (shellError.stderr.includes('command not found') || 
           shellError.stderr.includes('bun: command not found'));
        
        if (isCommandNotFound) {
          printer.finish(cmd);
          finishTaskInfo(taskInfo, true, null, "fallback to exec");
          
          const { default: exec } = await import("./exec.js");
          let execPromise = exec([cmd]);
          if (envs) execPromise = execPromise.env(envs);
          if (cwd) execPromise = execPromise.cwd(cwd);
          const result = await execPromise;
          resolve(result);
          return;
        }
        
        if (shellError.exitCode !== undefined) {
          const stderr = shellError.stderr ? Buffer.isBuffer(shellError.stderr) ? shellError.stderr.toString() : shellError.stderr : "";
          const stdout = shellError.stdout ? Buffer.isBuffer(shellError.stdout) ? shellError.stdout.toString() : shellError.stdout : "";
          const errorOutput = (stderr + stdout).trim() || `Command failed with exit code ${shellError.exitCode}`;
          
          if (errorOutput) {
            const lines = errorOutput.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                printer.output(line, true);
              }
            }
          }
          
          const metadata = {
            taskType: 'shell',
            exitCode: shellError.exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          };
          
          const error = new Error(`Exit code: ${shellError.exitCode}`);
          printer.error(cmd, null, { exitCode: shellError.exitCode });
          finishTaskInfo(taskInfo, false, error, errorOutput);
          resolve(TaskResult.fail(errorOutput, metadata));
          return;
        } else {
          const errorMessage = shellError.message || shellError.toString();
          printer.error(cmd, shellError);
          finishTaskInfo(taskInfo, false, shellError, errorMessage);
          resolve(TaskResult.fail(errorMessage, { taskType: 'shell' }));
        }
      }
    } catch (error) {
      printer.error(cmd, error);
      finishTaskInfo(taskInfo, false, error, error.message);
      resolve(TaskResult.fail(error.message, { taskType: 'shell' }));
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
