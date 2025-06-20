import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import { debugTask, isStaticOutput } from '../output.js';
import { renderTask, TaskInfo, TaskResult, tasksExecuted } from '../task.jsx';


const DEFAULT_OUTPUT_SIZE = 10;

export default async function httpFetch() {
  const textDecoder = new TextDecoder();

  const url = arguments[0];
  const method = arguments[1]?.method || 'GET';
  const text = `${method} ${url}`;
  
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

  let promise = startPromise.then(() => {
    return new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  });
  
  const FetchOutput = () => {
    const stackOutput = [];
    
    const [response, setResponse] = useState(null);
    const [printedLines, setPrintedLines] = useState([]);

    useEffect(() => {
      // Wait for start signal before executing
      startPromise.then(() => {
        const fetchPromise = fetch(...arguments);
        
        fetchPromise.then(async (response) => {
        setResponse(response);

        // Don't set dummy content - let it fill naturally
        for await (const chunk of response.body) {

          const lines = textDecoder.decode(chunk, { stream: true }).toString().split('\n');
          lines.forEach((line) => {
            debugTask(text, line);
            stackOutput.push(line);
            setPrintedLines(stackOutput.slice(-DEFAULT_OUTPUT_SIZE));
            
            // In CI mode, output each line immediately with task pattern
            if (isStaticOutput && line.trim()) {
              const taskExecution = tasksExecuted.find(t => t.text === text);
              if (taskExecution) {
                console.log(`${taskExecution.prefix(taskExecution.pattern)} ${line}`);
              }
            } else if (!isStaticOutput && line.trim()) {
              // In rich UI mode, update the displayed lines in real-time
              setPrintedLines([...stackOutput]);
            }
          });          
        }
        
        resolve(TaskResult.success(stackOutput.join('\n')));
        }).catch(error => {
          resolve(TaskResult.fail(error.toString()));
        });
      });
    }, []);
    
    if (isStaticOutput) return <></>

    // Always render the frame
    return (
      <Box flexDirection="column" borderStyle="round" padding={1}>
        {/* Live output area */}
        <Box flexDirection="column">
          {printedLines && printedLines.length > 0 ? (
            printedLines.map((line, i) => (
              <Text wrap="truncate" key={i}>{line.trim()}</Text>
            ))
          ) : null}
        </Box>
        
        {/* Status bar at bottom */}
        {response && (
          <Box marginTop={printedLines && printedLines.length > 0 ? 1 : 0}>
            {response.ok && (
              <Text color="green">✓ Success ({response.status} {response.statusText})</Text>
            )}
            {!response.ok && (
              <Text color="red">✗ Failed ({response.status} {response.statusText})</Text>
            )}
          </Box>
        )}
      </Box>
    )
  }

  // Delay renderTask call to allow planning phase to detect parallel tasks
  setTimeout(() => {
    const taskInfo = new TaskInfo({
      promise,
      kind: 'fetch',
      text,
    });
    taskInfo.startExecution = startExecution;

    renderTask(taskInfo, <FetchOutput />);
  }, 10); // Small delay to ensure all Promise.all tasks are registered first

  return promise;
}