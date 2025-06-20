import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { Timer } from 'timer-node';
import chalk from 'chalk';
import { render, clearRenderer, renderOnce, destroyRenderer, forceTerminalCleanup, renderToString, isStaticOutput } from './output.js';

// Force chalk to enable colors even in non-TTY environments
chalk.level = 1; // 1 = basic 16 colors, 2 = 256 colors, 3 = 16 million colors

export const TaskStatus = {
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];


// ASCII pseudo-graphic character patterns (exactly 3 chars each, 5 total with brackets)
const TASK_PATTERNS = [
  '=*=', '-+-', '#*#', '<->', '%*%', '{@}', '~^~', '.o.', 
  '***', '---', ':*:', '+++', '###', '%%%', '@@@', '^^^',
  '=/=', '-|-', '*+*', '<#>', '!*!', '{%}', '~@~', '.^.',
  '=-=', '-#-', '*%*', '<%>', '&*&', '{^}', '~o~', '.#.',
  '=+=', '-*-', '$*$', '<@>', '?*?', '{o}', '~#~', '.*.',
  '=^=', '-%-', '&#&', '<o>', '&+&', '{*}', '~+~', '.%.',
  '=@=', '-^-', ':+:', '<*>', '!+!', '{+}', '~*~', '.@.',
  '=o=', '-@-', '*^*', '<+>', '?+?', '{#}', '~%~', '.+.'
];

// Colors for random selection (avoiding red/green to prevent status confusion)
const TASK_COLORS = ['blue', 'yellow', 'magenta', 'cyan', 'white', 'gray', 'blueBright', 'yellowBright', 'magentaBright', 'cyanBright', 'whiteBright'];

// Global task container state
let globalTaskContainer = {
  activeTasks: new Map(), // taskId -> { taskInfo, component, startTime, status }
  activeComponents: [],
  rendererId: 'global-container',
  isRendering: false,
  completedTasks: new Map(),
  lastTaskStartTime: 0,
  groupTimeout: null,
  planningPhase: false,
  plannedTasks: new Map(), // taskId -> { taskInfo, component, delay }
  planningTimeout: null
};

let sequentialTaskCounter = 0;
let taskRenderers = new Map(); // Track which renderer each task uses
let completedTaskIds = new Set(); // Track completed tasks to prevent duplicates
let outputtedTaskIds = new Set(); // Track which tasks have been output to console
let firstTaskStarted = false; // Track if we've cleared initial artifacts
let patternAssignmentIndex = 0; // Track pattern assignment

// Helper function to format task pattern with color
function formatTaskPattern(taskInfo) {
  return taskInfo.prefix(taskInfo.pattern);
}

// Global output buffer to preserve all task group outputs
let globalOutputBuffer = [];
let outputBufferIndex = 0; // Track what's already been output

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
  let startExecution = null;

  if (!fn) {
    fn = name;
    name = fn.toString().slice(0, 50).replace(/\s+/g, ' ').trim();
  }

  // Create a promise that can be started later
  let resolveStart, rejectStart;
  const startPromise = new Promise((resolve, reject) => {
    resolveStart = resolve;
    rejectStart = reject;
  });

  startExecution = () => {
    resolveStart();
  };

  // Chain the actual execution after start signal
  const promise = startPromise.then(() => {
    return Promise.resolve(fn()).then((ret) => {
      fnResult = ret;
      return TaskResult.success(ret);
    }).catch((err) => {
      return TaskResult.fail(err);
    });
  });

  const taskInfo = new TaskInfo({ promise, kind: 'task', text: name });
  taskInfo.startExecution = startExecution;

  const TaskOutput = () => {
    const [output, setOutput] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    const [taskResult, setTaskResult] = useState(null);

    useEffect(() => {
      promise.then((result) => {
        setTaskResult(result);
        setIsComplete(true);
        // result is the TaskResult object with .output property
        if (result && result.output !== null && result.output !== undefined) {
          const outputText = typeof result.output === 'string' ? result.output : String(result.output);
          setOutput(outputText);
        }
      });
    }, []);

    if (isStaticOutput) return null;

    return (
      <Box flexDirection="column" borderStyle="round" padding={1} minHeight={5}>
        {/* Live output area */}
        <Box flexDirection="column" flexGrow={1}>
          {output ? (
            output.split('\n').slice(0, 8).map((line, i) => (
              <Text wrap="truncate-end" key={i}>{line}</Text>
            ))
          ) : !isComplete ? (
            <Text dimColor>Executing...</Text>
          ) : null}
        </Box>
        
        {/* Status bar at bottom */}
        <Box marginTop={1} borderTop borderStyle="single">
          {isComplete && taskResult?.status === 'success' && (
            <Text color="green">✓ Success</Text>
          )}
          {isComplete && taskResult?.status === 'fail' && (
            <Text color="red">✗ Failed</Text>
          )}
        </Box>
      </Box>
    )
  }
  renderTask(taskInfo, <TaskOutput />);

  await promise;
  return fnResult;
}

function addToGlobalContainer(comp) {
  const now = Date.now();
  const taskInfo = comp.props.taskInfo;
  const timeSinceLastTask = now - globalTaskContainer.lastTaskStartTime;

  globalTaskContainer.lastTaskStartTime = now;

  // Clear any existing planning timeout
  if (globalTaskContainer.planningTimeout) {
    clearTimeout(globalTaskContainer.planningTimeout);
    globalTaskContainer.planningTimeout = null;
  }

  // Debug timing
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`Task ${taskInfo.id}: planningPhase=${globalTaskContainer.planningPhase}, timeSince=${timeSinceLastTask}ms`);
  }

  // Check if this should start a new planning phase
  if (!globalTaskContainer.planningPhase && (globalTaskContainer.activeTasks.size === 0 || timeSinceLastTask < 500)) {
    startPlanningPhase();
  }

  if (globalTaskContainer.planningPhase) {
    // Add to planned tasks with small incremental delay - NO RENDERING YET
    const planningDelay = globalTaskContainer.plannedTasks.size * 50; // 50ms between each task
    globalTaskContainer.plannedTasks.set(taskInfo.id, {
      taskInfo,
      component: comp,
      delay: planningDelay
    });

    // Extend planning phase
    globalTaskContainer.planningTimeout = setTimeout(() => {
      executePlannedTasks();
    }, 200); // Wait 200ms after last task for more

    // DO NOT RENDER - wait for planning phase to complete

  } else {
    // Execute immediately as sequential task
    executeTaskImmediately(comp);
  }
}

function startPlanningPhase() {
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log('Starting planning phase');
  }
  globalTaskContainer.planningPhase = true;
  globalTaskContainer.plannedTasks.clear();
}

async function executePlannedTasks() {
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`Executing ${globalTaskContainer.plannedTasks.size} planned tasks`);
  }

  globalTaskContainer.planningPhase = false;
  globalTaskContainer.planningTimeout = null;

  const tasks = Array.from(globalTaskContainer.plannedTasks.values());

  if (tasks.length === 0) return;

  // Set up the layout first based on all planned tasks
  const components = tasks.map(t => t.component);
  globalTaskContainer.activeComponents = components;

  // Add all tasks to active container
  tasks.forEach(({ taskInfo, component }) => {
    globalTaskContainer.activeTasks.set(taskInfo.id, {
      taskInfo,
      component,
      startTime: Date.now(),
      status: 'running'
    });
    taskRenderers.set(taskInfo.id, globalTaskContainer.rendererId);
  });

  // Render the complete layout immediately
  const layout = createDynamicLayout(components);

  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`🔀 Parallel group: ${tasks.length} tasks -> ${globalTaskContainer.rendererId}`);
  }

  render(layout, globalTaskContainer.rendererId);
  globalTaskContainer.isRendering = true;

  // Now execute all tasks with their delays
  tasks.forEach(({ taskInfo, delay }) => {
    setTimeout(() => {
      // Find the task in tasksExecuted and trigger its execution
      const taskExecution = tasksExecuted.find(t => t.id === taskInfo.id);
      if (taskExecution) {
        taskExecution.startExecution?.();
      }
    }, delay);
  });

  globalTaskContainer.plannedTasks.clear();
}

function executeTaskImmediately(comp) {
  const taskInfo = comp.props.taskInfo;

  // Execute as sequential task
  sequentialTaskCounter++;
  const rendererId = `sequential-${sequentialTaskCounter}`;
  taskRenderers.set(taskInfo.id, rendererId);

  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`🎯 Sequential task: ${taskInfo.text} -> ${rendererId}`);
  }

  render(comp, rendererId);

  // Find and start execution immediately
  const taskExecution = tasksExecuted.find(t => t.id === taskInfo.id);
  if (taskExecution) {
    taskExecution.startExecution?.();
  }
}

function updateGlobalLayout() {
  if (!globalTaskContainer.isRendering || globalTaskContainer.activeComponents.length === 0) {
    return;
  }

  const layout = createDynamicLayout(globalTaskContainer.activeComponents);
  render(layout, globalTaskContainer.rendererId);
}

function createDynamicLayout(components) {
  const count = components.length;

  if (count === 1) {
    // Full width for single task - constrain height to content only
    return <Box flexDirection="column" width="100%" height="auto" minHeight={0}>
      {components}
    </Box>;
  }

  if (count === 2) {
    // 50/50 split - constrain height to content
    return <Box flexDirection="row" width="100%" height="auto" minHeight={0}>
      {components}
    </Box>;
  }

  if (count === 3) {
    // 1/3 each horizontally - constrain height to content
    return <Box flexDirection="row" width="100%" height="auto" minHeight={0}>
      {components}
    </Box>;
  }

  if (count <= 4) {
    // 2x2 grid - constrain height to content
    return <Box flexDirection="column" width="100%" height="auto" minHeight={0}>
      <Box flexDirection="row" width="100%">
        {components.slice(0, 2)}
      </Box>
      <Box flexDirection="row" width="100%">
        {components.slice(2, 4)}
      </Box>
    </Box>;
  }

  if (count <= 6) {
    // 2x3 grid - constrain height to content
    return <Box flexDirection="column" width="100%" height="auto" minHeight={0}>
      <Box flexDirection="row" width="100%">
        {components.slice(0, 3)}
      </Box>
      <Box flexDirection="row" width="100%">
        {components.slice(3, 6)}
      </Box>
    </Box>;
  }

  // Fallback for many tasks - vertical stack, constrain height to content
  return <Box flexDirection="column" width="100%" height="auto" minHeight={0}>
    {components}
  </Box>;
}

function finalizeTaskGroup() {
  // This locks in the current task group - no more tasks will be added to this group
  globalTaskContainer.groupTimeout = null;
}



function removeFromGlobalContainer(taskInfo) {
  const rendererId = taskRenderers.get(taskInfo.id);

  if (rendererId === globalTaskContainer.rendererId) {
    // Task is part of global container
    globalTaskContainer.activeTasks.delete(taskInfo.id);
    globalTaskContainer.activeComponents = globalTaskContainer.activeComponents.filter(
      comp => comp.props.taskInfo?.id !== taskInfo?.id
    );

    // Move to completed tasks
    globalTaskContainer.completedTasks.set(taskInfo.id, {
      taskInfo,
      result: taskInfo.result,
      duration: taskInfo.time
    });

    // Update layout with remaining tasks
    if (globalTaskContainer.activeComponents.length > 0) {
      updateGlobalLayout();
      return;
    }

    // All tasks in global container completed
    if (globalTaskContainer.activeTasks.size === 0) {
      if (process.env.DEBUG?.includes('bunosh')) {
        console.log('All tasks completed, capturing global container output');
      }
      captureGlobalContainerOutput();
      resetGlobalContainer();
    }
  } else {
    // Sequential task - handle individually
    if (rendererId) {
      destroyRenderer(rendererId);
      taskRenderers.delete(taskInfo.id);
    }
  }
}

async function captureGlobalContainerOutput() {
  const completedTasks = Array.from(globalTaskContainer.completedTasks.values());

  if (completedTasks.length === 0) return;
  
  // Output status lines for exec tasks, filter them out from static output
  const execTasks = completedTasks.filter(task => task.taskInfo.kind === 'exec');
  const tasksToOutput = completedTasks.filter(task => task.taskInfo.kind !== 'exec');
  
  // Output status lines for exec tasks since they already showed live output
  execTasks.forEach(({ taskInfo, result, duration }) => {
    const statusChar = result?.status === TaskStatus.SUCCESS ? '✓' : '✗';
    const statusLine = `${statusChar} ${taskInfo.kind} ${taskInfo.text}${taskInfo.extraText ? ` ${taskInfo.extraText}` : ''} ${duration}ms`;
    console.log('\n' + statusLine);
  });
  
  // If only exec tasks, skip all the static output generation and canvas clearing
  if (tasksToOutput.length === 0) {
    return; // No tasks need static output, and exec tasks already handled
  }

  try {
    // Create static components for non-exec tasks only
    const staticComponents = tasksToOutput.map(({ taskInfo, result, duration }) => {
      const outputLines = result?.output ? result.output.split('\n').slice(0, 8) : [];
      const staticChildren = outputLines.length > 0 ? (
        <Box overflow='hidden' height={Math.min(outputLines.length + 2, 10)} borderStyle="round" flexDirection="column">
          {outputLines.map((line, i) => (
            <Text wrap="truncate-end" key={i} dimColor={true}>{line}</Text>
          ))}
        </Box>
      ) : (
        <Box overflow='hidden' height={10} borderStyle="round">
          <Text dimColor={true}></Text>
        </Box>
      );

      return (
        <Box flexGrow={1} flexShrink={1} flexBasis={0} flexDirection='column' minHeight={0} key={taskInfo.id}>
          <Box gap={1} flexDirection='row' alignItems='flex-start' justifyContent="flex-start">
            <Text color={result?.status === TaskStatus.SUCCESS ? 'green' : 'red'} bold>
              {result?.status === TaskStatus.SUCCESS ? '✓' : '×'}
            </Text>
            <Text bold>{taskInfo.kind}</Text>
            <Text color='yellow'>{taskInfo.text}</Text>
            {taskInfo.extraText && <Text color='cyan' dimColor>{taskInfo.extraText}</Text>}
            <Text dimColor={true}>{duration}ms</Text>
          </Box>
          {staticChildren}
          <Box>
            <Text dimColor color={result?.status === TaskStatus.SUCCESS ? 'green' : 'red'}>
              {result?.status === TaskStatus.SUCCESS ? 'Success! Exit code: 0' : `Failure! Exit code: ${result?.exitCode || 1}`}
            </Text>
          </Box>
        </Box>
      );
    });

    // Create final layout and render to string
    const finalLayout = createDynamicLayout(staticComponents);
    const staticOutput = await renderToString(finalLayout);

    // Add this output to the global buffer - NO IMMEDIATE OUTPUT OR CLEARING
    if (staticOutput.trim()) {
      globalOutputBuffer.push(staticOutput.trim());
    }

    // Check if ALL tasks across ALL groups are completed before clearing/outputting
    if (isAllTasksCompleted()) {
      // Only perform screen clearing and buffered output in interactive mode
      if (!isStaticOutput) {
        // Only now perform clearing and final output
        clearInkCanvas();

        // Output only the new task group results (from outputBufferIndex onwards)
        for (let i = outputBufferIndex; i < globalOutputBuffer.length; i++) {
          console.log(globalOutputBuffer[i]);
          if (i < globalOutputBuffer.length - 1) {
            console.log(); // Add spacing between task groups, but not after the last one
          }
        }

        // Update the index to mark everything as output
        outputBufferIndex = globalOutputBuffer.length;
      }
      // In CI mode, tasks already output themselves immediately
    }
  } catch (error) {
    console.error('Failed to capture global container output:', error);
  }
}

function isAllTasksCompleted() {
  // Check if there are any active renderers still running
  const hasActiveRenderers = taskRenderers.size > 0;

  // Check if planning phase is active (more tasks might be coming)
  const planningPhaseActive = globalTaskContainer.planningPhase || globalTaskContainer.planningTimeout;

  // Check if global container has active tasks
  const hasActiveGlobalTasks = globalTaskContainer.activeTasks.size > 0;

  // All tasks are completed when:
  // 1. No active renderers
  // 2. No planning phase active
  // 3. No active tasks in global container
  const allCompleted = !hasActiveRenderers && !planningPhaseActive && !hasActiveGlobalTasks;

  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`Task completion check: renderers=${taskRenderers.size}, planning=${planningPhaseActive}, globalActive=${hasActiveGlobalTasks}, allCompleted=${allCompleted}`);
  }

  return allCompleted;
}

function outputTaskStartCI(taskInfo) {
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

  console.log(chalk.dim(`${formatTaskPattern(taskInfo)} ${chalk.bold.cyan('▶')} ${chalk.bold(taskInfo.kind)} ${taskInfo.text}${taskInfo.extraText ? ` ${taskInfo.extraText}` : ''} [${timestamp}]`));
}

function outputTaskResultCI(taskInfo, result, timeMs) {
  const statusChar = result.status === TaskStatus.SUCCESS ? '✓' : '✗';
  const statusColor = result.status === TaskStatus.SUCCESS ? chalk.green : chalk.red;

  // For streaming tasks (exec, fetch), output was already streamed line by line
  // For other tasks, output the buffered content
  const isStreamingTask = taskInfo.kind === 'exec' || taskInfo.kind === 'fetch';
  
  if (!isStreamingTask && result.output && result.output.trim()) {
    const lines = result.output.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      console.log(); // Blank line instead of "Output:" word
      if (lines.length > 10) {
        console.log(`${formatTaskPattern(taskInfo)} ${chalk.dim(`... (${lines.length - 10} more lines)`)}`);
      }
      lines.slice(-10).forEach(line => {
        console.log(`${formatTaskPattern(taskInfo)} ${line}`);
      });
    }
  }

  // Final completion line with status - this appears last as requested
  console.log(`${formatTaskPattern(taskInfo)} ${statusColor.bold(statusChar)} ${chalk.bold(taskInfo.kind)} ${chalk.underline(taskInfo.text)}${taskInfo.extraText ? ` ${taskInfo.extraText}` : ''} ${chalk.dim(`(Time taken: ${timeMs}ms)`)}`);
  console.log(); // Add spacing between tasks
}

function clearInitialArtifacts() {
  // Clear any initial rendering artifacts when first task starts
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log('🧽 Clearing initial artifacts');
  }

  // Don't use ANSI codes that might show up in output
  // Instead, just ensure we start fresh with a newline if needed
  const hasExistingContent = process.stdout.cursorPos && process.stdout.cursorPos.rows > 0;
  if (hasExistingContent) {
    console.log(''); // Add a clean separator
  }
}

function clearInkCanvas() {
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log('🧽 Clearing Ink canvas');
  }

  // Clear the entire screen and reset cursor to top
  process.stdout.write('\x1b[2J\x1b[H');

  // Reset formatting
  process.stdout.write('\x1b[0m');

  // Add a marker comment to show where clean output starts
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log('--- CLEAN OUTPUT STARTS HERE ---');
  }

  // Re-output all previously buffered content cleanly
  for (let i = 0; i < outputBufferIndex; i++) {
    console.log(globalOutputBuffer[i]);
    if (i < outputBufferIndex - 1) {
      console.log(); // Add spacing between task groups, but not after the last one
    }
  }
}

function resetGlobalContainer() {
  // Clear Ink canvas first before destroying renderer
  clearRenderer(globalTaskContainer.rendererId);

  globalTaskContainer.activeTasks.clear();
  globalTaskContainer.activeComponents = [];
  globalTaskContainer.completedTasks.clear();
  globalTaskContainer.isRendering = false;
  globalTaskContainer.lastTaskStartTime = 0;

  if (globalTaskContainer.groupTimeout) {
    clearTimeout(globalTaskContainer.groupTimeout);
    globalTaskContainer.groupTimeout = null;
  }
}

export const renderTask = async (taskInfo, children) => {
  if (tasksExecuted.map(t => t.id).includes(taskInfo.id)) return; // already executed

  tasksExecuted.push(taskInfo);

  const taskComponent = <Task key={`${tasksExecuted.length}_${taskInfo}`} taskInfo={taskInfo}>{children}</Task>;
  addToGlobalContainer(taskComponent);
};




async function captureAndOutputInkState(taskInfo, result, timeMs, children) {
  // Don't output anything - the live execution already showed the content
  // Just output the status line without duplicating the content
  try {
    const statusChar = result.status === TaskStatus.SUCCESS ? '✓' : '✗';
    const statusLine = `${statusChar} ${taskInfo.kind} ${taskInfo.text}${taskInfo.extraText ? ` ${taskInfo.extraText}` : ''} ${timeMs}ms`;
    
    console.log(statusLine);
    console.log(); // Add spacing after task
  } catch (error) {
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

    // Don't clear individual renderers - let the group handle clearing when all tasks complete
    const rendererId = taskRenderers.get(taskInfo.id);

    // Handle output based on whether this is a parallel or sequential task
    if (!outputtedTaskIds.has(taskInfo.id)) {
      outputtedTaskIds.add(taskInfo.id);

      if (rendererId === globalTaskContainer.rendererId) {
        // Parallel task - in CI mode output immediately, otherwise wait for group completion
        if (isStaticOutput) {
          outputTaskResultCI(taskInfo, result, timer.ms());
        }
        // Interactive mode - don't output individually, will be captured when all complete
      } else {
        // Sequential task - output immediately
        if (isStaticOutput) {
          outputTaskResultCI(taskInfo, result, timer.ms());
        } else {
          // Rich UI mode - for exec tasks, just output the status line since live output was already shown
          if (taskInfo.kind === 'exec') {
            const statusChar = result.status === TaskStatus.SUCCESS ? '✓' : '✗';
            const statusLine = `${statusChar} ${taskInfo.kind} ${taskInfo.text}${taskInfo.extraText ? ` ${taskInfo.extraText}` : ''} ${timer.ms()}ms`;
            console.log('\n' + statusLine);
            console.log(); // Add spacing after task
          } else {
            // For non-exec tasks, use the normal capture method
            captureAndOutputInkState(taskInfo, result, timer.ms(), children).catch(err => {
              console.error('Failed to capture task state:', err);
            });
          }
        }
      }
    }

    // Remove from active rendering first
    removeFromGlobalContainer(taskInfo);

    // Always clean up task renderer tracking for all task types
    if (rendererId && rendererId !== globalTaskContainer.rendererId) {
      // Sequential task - brief delay to let completed state render, then clean up
      setTimeout(() => {
        destroyRenderer(rendererId);
        taskRenderers.delete(taskInfo.id);
      }, 50); // Very brief delay to let completion state render
    } else if (rendererId === globalTaskContainer.rendererId) {
      // Parallel task - will be cleaned up when all parallel tasks complete
      // But remove from tracking when this specific task is done
      taskRenderers.delete(taskInfo.id);
    }

    // hard exit, task has failed
    if (result.status === TaskStatus.FAIL && stopFailToggle) {
      process.exit(1);
    }
  }

  useEffect(() => {
    // In CI mode, output task start header
    if (isStaticOutput) {
      outputTaskStartCI(taskInfo);
    }

    promise.then((result) => {
      updateTaskInfo(result)
    }).catch((err) => {
      updateTaskInfo(TaskResult.fail(err.toString()));
    });
  }, []);

  // In CI mode, render minimal UI to avoid spinners but keep functionality

  // For completed tasks, render a brief clean completion indicator before disappearing
  if (status !== null && !isStaticOutput) {
    return (
      <Box flexDirection='column' minHeight={0}>
        <Box gap={1} flexDirection='row' alignItems='flex-start' justifyContent="flex-start">
          <Status taskStatus={status} />
          {taskInfo.titleComponent}
          {taskInfo.extraText && <Text color='cyan' dimColor>{taskInfo.extraText}</Text>}
          <Text dimColor={true}>{time}ms</Text>
        </Box>
      </Box>
    );
  }

  // In CI mode, return null for completed tasks since output is handled by console.log
  if (status !== null && isStaticOutput) {
    return null;
  }

  // Only use flexGrow for parallel layouts (when more than 1 task in global container)
  const isParallelTask = taskRenderers.get(taskInfo.id) === globalTaskContainer.rendererId;
  const useFlexGrow = isParallelTask && globalTaskContainer.activeTasks.size > 1;

  return (<Box flexDirection='column' minHeight={0}
               flexGrow={useFlexGrow ? 1 : 0}
               flexShrink={useFlexGrow ? 1 : 0}
               flexBasis={useFlexGrow ? 0 : 'auto'}>
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
    // Assign unique pattern and random color to this task
    const patternIndex = patternAssignmentIndex % TASK_PATTERNS.length;
    this.pattern = TASK_PATTERNS[patternIndex];

    // Create prefix function with random color
    const randomColor = TASK_COLORS[Math.floor(Math.random() * TASK_COLORS.length)];
    this.prefix = (pattern) => chalk[randomColor](`[${pattern}]`);

    patternAssignmentIndex++;
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
