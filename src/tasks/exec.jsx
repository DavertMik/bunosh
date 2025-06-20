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
        
        // Build shell with stderr redirected to stdout for line-by-line reading
        let shell = $`sh -c '${cmd} 2>&1'`.nothrow();

        if (cwd) {
          shell = shell.cwd(cwd);
        } 
        if (envs) {
          shell = shell.env(envs);
        }

        // Read all output (stdout + stderr) line by line
        for await (let line of shell.lines()) {
          debugTask(cmd, line);
          stackOutput.push(line);
          
          // In CI mode, output with task pattern
          if (isStaticOutput) {
            const taskExecution = tasksExecuted.find(t => t.text === cmd);
            if (taskExecution) {
              console.log(`${taskExecution.prefix(taskExecution.pattern)} ${line}`);
            }
          } else {
            // In rich UI mode, update the displayed lines in real-time
            // Use functional update to ensure we get the latest state
            setPrintedLines(prev => {
              const newLines = [...stackOutput];
              return newLines;
            });
            
            // Add a small delay to allow React to process the state update
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }

        const { exitCode } = await shell;

        const code = parseInt(exitCode, 10);
        setExitCode(code);
        setIsRunning(false);
        if (code == 0) resolve(TaskResult.success(stackOutput.join('\n')));
        if (code !== 0) resolve(TaskResult.fail(stackOutput.join('\n')));
      } catch (error) {
        // Catch any errors that Bun might throw before our handling
        debugTask(cmd, error.toString());
        stackOutput.push(`Error: ${error.message}`);
        setPrintedLines([...stackOutput]);
        setExitCode(1);
        setIsRunning(false);
        resolve(TaskResult.fail(`Error: ${error.message}`));
      }
    };

    useEffect(() => {
      // Wait for start signal before executing
      startPromise.then(() => {
        readNextChunk();
      });
    }, []);
    
    if (isStaticOutput) return <></>

    // Always render the frame with live output
    return (
      <Box flexDirection="column" borderStyle="round" padding={1}>
        {/* Live output area */}
        <Box flexDirection="column">
          {printedLines.length > 0 ? (
            printedLines.map((line, i) => (
              <Text wrap="end" key={i}>{line}</Text>
            ))
          ) : isRunning ? (
            <Text dimColor>Starting...</Text>
          ) : (
            <Text dimColor>No output</Text>
          )}
        </Box>
      </Box>
    )
  }

  // Delay renderTask call to allow planning phase to detect parallel tasks
  setTimeout(() => {
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
  }, 10); // Small delay to ensure all Promise.all tasks are registered first

  return cmdPromise;
}
