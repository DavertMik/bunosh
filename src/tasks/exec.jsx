import { $ } from "bun";
import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import { debugTask, isStaticOutput } from '../output.js';
import { renderTask, TaskInfo, TaskResult } from '../task.jsx';

const DEFAULT_OUTPUT_SIZE = 10;

export default async function exec(strings, ...values) {
  
  const cmd = strings.reduce((accumulator, str, i) => {
    return accumulator + str + (values[i] || '');
  }, '');

  let resolve, reject;
  let cmdPromise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  
  const ExecOutput = () => {
    const shell = $(strings, ...values);
    
    const stackOutput = [];
    
    const [printedLines, setPrintedLines] = useState([]);
    const [exitCode, setExitCode] = useState(null);

    const readNextChunk = async () => {
      for await (let line of shell.lines()) {
        debugTask(cmd, line);
        stackOutput.push(line);
        setPrintedLines(stackOutput.slice(-DEFAULT_OUTPUT_SIZE));
      }
      const code = parseInt((await shell).exitCode, 10);
      setExitCode(code);
      if (code == 0) resolve(TaskResult.success(stackOutput.join('\n')));
      if (code !== 0) resolve(TaskResult.fail(stackOutput.join('\n')));
    };

    useEffect(() => {
      readNextChunk();
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

  renderTask(new TaskInfo({
    promise: cmdPromise,
    kind: 'exec',
    text: cmd,
  }), <ExecOutput />);

  return cmdPromise;
}

