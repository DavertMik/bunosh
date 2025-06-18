import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { Timer } from 'timer-node';
import { render, clearRenderer, renderOnce, destroyRenderer, forceTerminalCleanup, renderToString } from './output.js';

export const TaskStatus = {  
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];


let activeComponents = [];
let activeTasks = [];
let isParallelGroup = false;
let lastTaskStartTime = 0;
let clearTimeoutId = null;
let sequentialTaskCounter = 0;
let taskRenderers = new Map(); // Track which renderer each task uses
let completedTaskIds = new Set(); // Track completed tasks to prevent duplicates
let outputtedTaskIds = new Set(); // Track which tasks have been output to console

let stopFailToggle = true;

export function stopOnFail(enable = true) {
  stopFailToggle = enable;
}

export function ignoreFail(enable = true) {
  stopFailToggle = !enable;
}

const globalTimer = new Timer({ label: 'global', precision: 'ms'});
globalTimer.start();
// Reset tracking on script start
if (process.env.BUNOSH_COMMAND_STARTED) {
  outputtedTaskIds.clear();
  completedTaskIds.clear();
}

process.on('exit', (code) => {
  // we don't need this banner if no tasks were executed
  if (!process.env.BUNOSH_COMMAND_STARTED) return;

  globalTimer.stop();
  const success = code === 0;
  const tasksFailed = tasksExecuted.filter(ti => ti.result?.status === TaskStatus.FAIL).length;
  
  // Clear all active renderers first
  clearRenderer();
  
  // Just output the final banner - completed tasks are already printed as single lines
  console.log(`\n🍲 ${success ? '' : 'FAIL '}Exit Code: ${code} | Tasks: ${tasksExecuted.length}${tasksFailed ? ` | Failed: ${tasksFailed}` : ''} | Time: ${globalTimer.ms()}ms`);
});

export async function task(name, fn) {
  let fnResult = null;

  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  const promise = Promise.resolve(fn()).then((ret) => {
    fnResult = ret;
    return TaskResult.success(ret);
  }).catch((err) => {    
    return TaskResult.fail(err);
  });
  const taskInfo = new TaskInfo({ promise, kind: 'task', text: name });

  const TaskOutput = () => {
    const [output, setOutput] = useState('');
    
    useEffect(() => {
      promise.then((result) => {
        // result is the TaskResult object with .output property
        if (result && result.output !== null && result.output !== undefined) {
          const outputText = typeof result.output === 'string' ? result.output : String(result.output);
          setOutput(outputText);
        }
      });
    }, []);

    if (!output) {
      return <Box overflow='hidden' height={10} borderStyle="round" >
        <Text dimColor={true}></Text>
      </Box>
    }

    return <Box overflow='hidden' height={10} borderStyle="round" flexDirection="column">
      {output.split('\n').slice(0, 8).map((line, i) => (
        <Text wrap="truncate-end" key={i} dimColor={true}>{line}</Text>
      ))}
    </Box>
  }
  renderTask(taskInfo, <TaskOutput />);

  await promise;
  return fnResult;
}

function addToRender(comp) {
  const now = Date.now();
  const timeSinceLastTask = now - lastTaskStartTime;
  
  
  
  // If starting fresh (no active components), always start new
  if (activeComponents.length === 0) {
    lastTaskStartTime = now;
    activeComponents.push(comp);
    activeTasks.push(comp.props.taskInfo);
    taskRenderers.set(comp.props.taskInfo.id, 'default');
    render(comp, 'default');
    return;
  }
  
  // If multiple tasks arrive quickly (< 200ms), group them in grid
  if (timeSinceLastTask < 200) {
    activeComponents.push(comp);
    activeTasks.push(comp.props.taskInfo);
    taskRenderers.set(comp.props.taskInfo.id, 'default');
    
    const layout = getLayoutForTaskCount(activeComponents.length);
    render(layout, 'default');
    return;
  }
  
  // If there's a delay (> 200ms), this is likely a new execution block
  // For now, just render it separately, we'll collect it later
  sequentialTaskCounter++;
  const rendererId = `sequential-${sequentialTaskCounter}`;
  taskRenderers.set(comp.props.taskInfo.id, rendererId);
  render(comp, rendererId);
}

function getLayoutForTaskCount(count) {
  if (count <= 2) {
    // Current horizontal layout
    return <Box flexDirection='row' gap={1}>
      {activeComponents}
    </Box>;
  }
  
  if (count <= 4) {
    // 2×2 Grid layout
    return <Box flexDirection='column' gap={1}>
      <Box flexDirection='row' gap={1}>
        {activeComponents.slice(0, 2)}
      </Box>
      <Box flexDirection='row' gap={1}>
        {activeComponents.slice(2, 4)}
      </Box>
    </Box>;
  }
  
  if (count <= 6) {
    // 2×3 Grid layout for first 6 tasks (likely parallel)
    const firstRow = activeComponents.slice(0, 3);
    const secondRow = activeComponents.slice(3, 6);
    const extraTasks = activeComponents.slice(6); // Sequential tasks after parallel block
    
    return <Box flexDirection='column' gap={1}>
      <Box flexDirection='row' gap={1} width="100%">
        {firstRow}
      </Box>
      {secondRow.length > 0 && (
        <Box flexDirection='row' gap={1} width="100%">
          {secondRow}
        </Box>
      )}
      {extraTasks.length > 0 && (
        <Box flexDirection='column' gap={1} marginTop={1}>
          {extraTasks}
        </Box>
      )}
    </Box>;
  }
  
  // Fallback: Vertical stack for many tasks
  return <Box flexDirection='column' gap={1}>
    {activeComponents}
  </Box>;
}



function removeFromRender(taskInfo) {
  activeTasks = activeTasks.filter((ti) => ti?.id !== taskInfo?.id);
  activeComponents = activeComponents.filter((comp) => comp.props.taskInfo?.id !== taskInfo?.id);

  // Re-render remaining tasks in updated layout
  if (activeComponents.length > 0) {
    const layout = getLayoutForTaskCount(activeComponents.length);
    render(layout, 'default');
    return;
  }

  // All tasks in this group are completed
  if (activeTasks.length === 0) {
    // Cancel any existing clear timeout to prevent race conditions
    if (clearTimeoutId) {
      clearTimeout(clearTimeoutId);
      clearTimeoutId = null;
    }
    
    
    // Clear all renderers and reset for next group (minimal cleanup)
    clearRenderer(); // Clear all renderers, not just default
    activeComponents = [];
    isParallelGroup = false;
    lastTaskStartTime = 0;
    completedTaskIds.clear(); // Reset for next batch
    // DON'T clear outputtedTaskIds here - keep it global to prevent all duplicates
    return;
  }
}

export const renderTask = async (taskInfo, children) => {
  if (tasksExecuted.map(t => t.id).includes(taskInfo.id)) return; // alraday executed


  tasksExecuted.push(taskInfo);
  addToRender(<Task key={`${tasksExecuted.length}_${taskInfo}`} taskInfo={taskInfo}>{children}</Task>);
};




async function captureAndOutputInkState(taskInfo, result, timeMs, children) {
  try {
    // Create the static version with the actual task output
    const outputLines = result.output ? result.output.split('\n').filter(line => line.trim()).slice(0, 8) : [];
    const staticChildren = outputLines.length > 0 ? (
      <Box overflow='hidden' height={Math.min(outputLines.length + 2, 10)} borderStyle="round" flexDirection="column">
        {outputLines.map((line, i) => (
          <Text wrap="truncate-end" key={i} dimColor={true}>{line}</Text>
        ))}
      </Box>
    ) : children;
    
    const completedTaskComponent = (
      <Box flexGrow={1} flexShrink={1} flexBasis={0} flexDirection='column' minHeight={0}>
        <Box gap={1} flexDirection='row' alignItems='flex-start' justifyContent="flex-start">
          <Text color={result.status === TaskStatus.SUCCESS ? 'green' : 'red'} bold>
            {result.status === TaskStatus.SUCCESS ? '✓' : '×'}
          </Text>
          <Text bold>{taskInfo.kind}</Text>
          <Text color='yellow'>{taskInfo.text}</Text>
          {taskInfo.extraText && <Text color='cyan' dimColor>{taskInfo.extraText}</Text>}
          <Text dimColor={true}>{timeMs}ms</Text>
        </Box>
        {staticChildren}
        <Box>
          <Text dimColor color={result.status === TaskStatus.SUCCESS ? 'green' : 'red'}>
            {result.status === TaskStatus.SUCCESS ? 'Success! Exit code: 0' : `Failure! Exit code: ${result.exitCode || 1}`}
          </Text>
        </Box>
      </Box>
    );
    
    // Render to string and output immediately
    const staticOutput = await renderToString(completedTaskComponent);
    if (staticOutput.trim()) {
      console.log(staticOutput);
    }
  } catch (error) {
    // If rendering to string fails, just skip it
    console.error('Failed to capture Ink state:', error);
  }
}

function Status({ taskStatus }) {
  if (!taskStatus) return <Text dimColor>-</Text>;
  if (taskStatus == TaskStatus.SUCCESS) return <Text color='green' bold>✓</Text>;
  if (taskStatus == TaskStatus.FAIL) return <Text color='red' bold>×</Text>;
}

export const Task = ({ taskInfo, children }) => {
  const timer = new Timer({ label: taskInfo.text, precision: 'ms'});

  const [time, setTime] = useState(null);
  const [status, setStatus] = useState(null);
  
  const { promise } = taskInfo;
  timer.start();
  
  function updateTaskInfo(result) {
    timer.stop();
    taskInfo.result = result;
    taskInfo.time = timer.ms();
    setStatus(result.status);
    setTime(timer.ms());
    
    // Prevent duplicate processing of the same task
    if (completedTaskIds.has(taskInfo.id)) {
      return;
    }
    completedTaskIds.add(taskInfo.id);
    
    const rendererId = taskRenderers.get(taskInfo.id);
    
    // Output the captured Ink UI state as static
    if (!outputtedTaskIds.has(taskInfo.id)) {
      outputtedTaskIds.add(taskInfo.id);
      
      // Capture the final Ink UI state and output it as static (async, but don't wait)
      captureAndOutputInkState(taskInfo, result, timer.ms(), children).catch(err => {
        console.error('Failed to capture task state:', err);
      });
    }
    
    // Immediately destroy any renderer for this task
    if (rendererId) {
      destroyRenderer(rendererId);
      taskRenderers.delete(taskInfo.id);
    }
    
    // Remove from active rendering
    removeFromRender(taskInfo);

    // hard exit, task has failed
    if (result.status === TaskStatus.FAIL && stopFailToggle) {
      process.exit(1);
    }
  }

  useEffect(() => {    
    promise.then((result) => {
      updateTaskInfo(result)
    }).catch((err) => {
      updateTaskInfo(TaskResult.fail(err.toString()));
    });
  }, []);

  // Don't render anything if the task is completed (we've already output the console summary)
  if (status !== null) {
    return null;
  }

  return (<Box flexGrow={1} flexShrink={1} flexBasis={0} flexDirection='column' minHeight={0}>
      <Box gap={1} flexDirection='row' alignItems='flex-start' justifyContent="flex-start">
        <Status taskStatus={status} />

        {taskInfo.titleComponent}

        {taskInfo.extraText && <Text color='cyan' dimColor>{taskInfo.extraText}</Text>}

        {time === null && <Spinner />}
        {time !== null && <Text dimColor={true}>{time}ms</Text>}
        
      </Box>

      {children}
      </Box>
  );
};

export class TaskInfo {
  constructor({ promise, kind, text, extraText }) {
    if (!kind) throw new Error('TaskInfo: kind is required');
    if (!text) throw new Error('TaskInfo: text is required');

    this.id = `${kind}-${text.slice(0,30).replace(/\s/g, '-')}-${Math.random().toString(36).substring(7)}`;
    this.kind = kind;
    this.text = text;
    this.extraText = extraText;
    this.promise = promise;
    this.result = null;
    this.time = null;
  }

  get titleComponent() {
    // Truncate text for better display in grid layouts
    const maxTextLength = 25;
    const truncatedText = this.text.length > maxTextLength 
      ? this.text.slice(0, maxTextLength) + '...' 
      : this.text;
      
    return <>  
      <Text bold>{this.kind}</Text>
      <Text color='yellow'>{truncatedText}</Text>
    </>;
  }

  toString() {
    return `${this.kind} ${this.text}`;
  }
}

export class TaskResult {
  constructor({ status, output }) {
    this.status = status;
    this.output = output;
  }

  static fail(output = null) {
    return new TaskResult({ status: TaskStatus.FAIL, output });
  }

  static success(output = null) {
    return new TaskResult({ status: TaskStatus.SUCCESS, output });

  }
}
