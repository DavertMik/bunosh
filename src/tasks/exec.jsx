import { $ } from "bun";
import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import { debugTask, isStaticOutput } from '../output.js';
import { renderTask, TaskInfo, TaskResult, tasksExecuted } from '../task.jsx';

const DEFAULT_OUTPUT_SIZE = 10;

export default function exec(strings, ...values) {
  
  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || '');
  });

  let resolve, reject;
  let startExecution = null;
  
  // Create a promise that can be started later
  let resolveStart;
  const startPromise = new Promise((res) => {
    resolveStart = res;
  });

  startExecution = () => {
    resolveStart();
  };

  const cmdPromise = startPromise.then(() => {
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  });

  let envs = null
  cmdPromise.env = (newEnvs) => {
    envs = newEnvs;
    return cmdPromise;
  }

  let cwd = null;
  cmdPromise.cwd = (newCwd) => {
    cwd = newCwd;
    return cmdPromise;
  }

  const ExecOutput = () => {
    const [printedLines, setPrintedLines] = useState([]);
    const [exitCode, setExitCode] = useState(null);
    const [isRunning, setIsRunning] = useState(false);

    const readNextChunk = async () => {
      const stackOutput = [];
      try {
        setIsRunning(true);
        
        // Build shell with the command - use eval to properly parse command and args
        let shell;
        try {
          // Use Function constructor to create a template literal with the command
          shell = new Function('$', `return $\`${cmd}\`.nothrow().quiet();`)($);
        } catch (e) {
          // Fallback to treating as a single command if template parsing fails
          shell = $`sh -c ${cmd}`.nothrow().quiet();
        }

        if (cwd) {
          shell = shell.cwd(cwd);
        } 
        if (envs) {
          shell = shell.env(envs);
        }
        
        // Execute the shell command
        const result = await shell;
        const { exitCode, stdout, stderr } = result;
        
        // Convert output to lines and process
        const allOutput = stdout.toString() + stderr.toString();
        const lines = allOutput.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          debugTask(cmd, line);
          stackOutput.push(line);
          
          // In CI mode, output with task pattern
          if (isStaticOutput) {
            const taskExecution = tasksExecuted.find(t => t.text === cmd);
            if (taskExecution) {
              console.log(`${taskExecution.prefix(taskExecution.pattern)} ${line}`);
            }
          } else {
            // In rich UI mode, update the displayed lines
            setPrintedLines([...stackOutput]);
          }
        }

        const code = parseInt(exitCode, 10);
        setExitCode(code);
        setIsRunning(false);
        
        // Include output in result for display in the final box
        if (code == 0) resolve(TaskResult.success(stackOutput.join('\n')));
        if (code !== 0) resolve(TaskResult.fail(stackOutput.join('\n')));
      } catch (error) {
        // Catch any errors that Bun might throw before our handling
        debugTask(cmd, error.toString());
        stackOutput.push(`Error: ${error.message}`);
        setPrintedLines([...stackOutput]);
        setExitCode(1);
        setIsRunning(false);
        resolve(TaskResult.fail(null));
      }
    };

    useEffect(() => {
      // Wait for start signal before executing
      startPromise.then(() => {
        readNextChunk();
      });
    }, []);
    
    if (isStaticOutput) return null;

    // Return output content to be used by StandardTaskFormat
    return (
      <Box flexDirection="column" width="100%">
        {printedLines.length > 0 ? (
          printedLines.slice(-15).map((line, i) => (
            <Text wrap="truncate-end" key={i}>{line}</Text>
          ))
        ) : isRunning ? (
          <Text dimColor>Starting command...</Text>
        ) : (
          <Text dimColor>No output</Text>
        )}
      </Box>
    )
  }

  // Create and render task immediately
  let extraText = '';
  if (cwd) extraText += `at ${cwd}`;
  if (envs) extraText += ` with ${envs}`;

  const taskInfo = new TaskInfo({
    promise: cmdPromise,
    kind: 'exec',
    text: cmd,
    extraText: extraText,
  });
  taskInfo.startExecution = startExecution;

  renderTask(taskInfo, <ExecOutput />);

  return cmdPromise;
}
