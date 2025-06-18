import { $ } from "bun";
import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import { debugTask, isStaticOutput } from '../output.js';
import { renderTask, TaskInfo, TaskResult } from '../task.jsx';

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
    const stackOutput = [];

    const [printedLines, setPrintedLines] = useState([]);
    const [exitCode, setExitCode] = useState(null);    

    const readNextChunk = async () => {
      try {
        let shell = $(strings, ...values).nothrow();

        if (cwd) {
          shell = shell.cwd(cwd);
        } 
        if (envs) {
          shell = shell.env(envs);
        }

        // there should be API to read stderr line by line...
        for await (let line of shell.lines()) {
          debugTask(cmd, line);
          stackOutput.push(line);
          setPrintedLines(stackOutput.slice(-DEFAULT_OUTPUT_SIZE));
        }

        const { exitCode, stderr } = await shell;

        if (stderr) {
          debugTask(cmd, stderr.toString());
          stackOutput.push(stderr.toString())
          setPrintedLines(stackOutput.slice(-DEFAULT_OUTPUT_SIZE));
        }

        const code = parseInt(exitCode, 10);
        setExitCode(code);
        if (code == 0) resolve(TaskResult.success(stackOutput.join('\n')));
        if (code !== 0) resolve(TaskResult.fail(stackOutput.join('\n')));
      } catch (error) {
        // Catch any errors that Bun might throw before our handling
        debugTask(cmd, error.toString());
        stackOutput.push(`Error: ${error.message}`);
        setPrintedLines(stackOutput.slice(-DEFAULT_OUTPUT_SIZE));
        setExitCode(1);
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

    return <>
      <Box marginBottom={1} flexDirection="column">
      {printedLines.length > 0 && <Box borderStyle="round" padding={1} flexDirection="column" >
        {printedLines.map((line, i) => <Text wrap="truncate" key={i}>{line.trim()}</Text>)}
      </Box>}
      <Box>
      {exitCode === 0 && <Text dimColor>Success! Exit code: {exitCode}</Text>}
      {exitCode !== null && exitCode != 0 && <Text dimColor color="red">Failure! Exit code: <Text bold>{exitCode}</Text></Text>}
      </Box>
      </Box>
    </>
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
