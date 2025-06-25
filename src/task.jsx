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

// Simple tracking for task execution
let taskCounter = 0;
let patternAssignmentIndex = 0;
let stopFailToggle = true;

// Helper function to format task pattern with color
function formatTaskPattern(taskInfo) {
  return taskInfo.prefix(taskInfo.pattern);
}

export function stopOnFail(enable = true) {
  stopFailToggle = enable;
}

export function ignoreFail(enable = true) {
  stopFailToggle = !enable;
}

const globalTimer = new Timer({ label: 'global', precision: 'ms'});
globalTimer.start();

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
      <StandardTaskFormat 
        taskInfo={taskInfo}
        output={output}
        isComplete={isComplete}
        taskResult={taskResult}
        runTime={taskResult?.time || taskInfo.time}
      />
    )
  }
  renderTask(taskInfo, <TaskOutput />);

  await promise;
  return fnResult;
}

// Standardized task format component
const StandardTaskFormat = ({ taskInfo, output, isComplete, taskResult, children, runTime }) => {
  return (
    <Box flexDirection="column" width="100%">
      {/* Content box */}
      <Box borderStyle="single" padding={1} flexDirection="column" minHeight={8} maxHeight={15}>
        {children || (output ? (
          output.split('\n').slice(0, 10).map((line, i) => (
            <Text wrap="truncate-end" key={i}>{line}</Text>
          ))
        ) : !isComplete ? (
          <Text dimColor>Executing...</Text>
        ) : (
          <Text dimColor>No output</Text>
        ))}
      </Box>
      
      {/* Status line outside the box */}
      <Box justifyContent="space-between" width="100%" paddingX={1}>
        <Box gap={1}>
          <Text bold>{taskInfo.kind}</Text>
          <Text color="yellow">{taskInfo.text}</Text>
          {taskInfo.extraText && <Text color="cyan" dimColor>{taskInfo.extraText}</Text>}
        </Box>
        <Box gap={1}>
          {runTime && <Text dimColor>{runTime}ms</Text>}
          {isComplete && taskResult?.status === 'success' && (
            <Text color="green" bold>✓ Success</Text>
          )}
          {isComplete && taskResult?.status === 'fail' && (
            <Text color="red" bold>✗ Failed</Text>
          )}
          {!isComplete && (
            <Text dimColor><Spinner type="dots" /> Running</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export const renderTask = async (taskInfo, children) => {
  if (tasksExecuted.map(t => t.id).includes(taskInfo.id)) return; // already executed

  tasksExecuted.push(taskInfo);
  taskCounter++;
  
  // Create unique renderer ID for this task
  const rendererId = `task-${taskCounter}-${taskInfo.id}`;
  
  // In CI mode, output task start header
  if (isStaticOutput) {
    outputTaskStartCI(taskInfo);
  }

  const taskComponent = <Task key={taskInfo.id} taskInfo={taskInfo} rendererId={rendererId}>{children}</Task>;
  
  // Each task gets its own Ink instance
  render(taskComponent, rendererId);
  
  // Start execution immediately
  const taskExecution = tasksExecuted.find(t => t.id === taskInfo.id);
  if (taskExecution?.startExecution) {
    taskExecution.startExecution();
  }
};

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

export const Task = ({ taskInfo, children, rendererId }) => {
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

    // Handle output based on mode
    if (isStaticOutput) {
      outputTaskResultCI(taskInfo, result, timer.ms());
    } else {
      // Rich UI mode - capture and output the final result
      setTimeout(async () => {
        try {
          // Capture the final rendered state as static output
          const staticOutput = await renderToString(
            <StandardTaskFormat 
              taskInfo={taskInfo}
              output={result.output}
              isComplete={true}
              taskResult={result}
              runTime={timer.ms()}
            />
          );
          
          // Destroy the Ink instance
          destroyRenderer(rendererId);
          
          // Output the static result to stdout
          if (staticOutput.trim()) {
            console.log(staticOutput);
            console.log(); // Add spacing between tasks
          }
        } catch (error) {
          console.error('Failed to capture task state:', error);
          // Fallback to simple status line
          const statusChar = result.status === TaskStatus.SUCCESS ? '✓' : '✗';
          const statusColor = result.status === TaskStatus.SUCCESS ? chalk.green : chalk.red;
          console.log(`${statusColor.bold(statusChar)} ${taskInfo.kind} ${taskInfo.text} ${timer.ms()}ms`);
        }
      }, 100); // Brief delay to let completion state render
    }

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

  // In CI mode, return null to avoid any UI
  if (isStaticOutput) {
    return null;
  }

  return children;
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