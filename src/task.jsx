import React, {useState, useEffect} from 'react';
import { Text, Box } from 'ink';
import Spinner from 'ink-spinner';
import { Timer } from 'timer-node';
import { render, clearRenderer, renderOnce } from './output';

export const TaskStatus = {  
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];


let activeComponents = [];
let activeTasks = [];

let stopFailToggle = true;

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
  renderOnce(<Box flexDirection='row' gap={2}>
    <Text bold backgroundColor={!success && 'red'}>🍲
      {success ? '' : 'FAIL '}
    </Text>
    <Text dimColor >Exit Code: <Text bold color={code === 0 ? 'green' : 'red'}>{code}</Text></Text>
    <Text dimColor>Tasks executed: <Text bold>{tasksExecuted.length}</Text></Text>
    {!!tasksFailed && <Text dimColor>Tasks failed: <Text bold color="red">{tasksFailed}</Text></Text>}
    <Text dimColor>Time: <Text bold>{globalTimer.ms()}</Text>ms</Text>
  </Box>);
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
    const [output, setOutput] = useState(null);
    useEffect(() => {
      if (!fnResult?.toString) return;
      promise.then(_ => setOutput(fnResult.toString()));
    });

    return <Box overflow='hidden' height={10} borderStyle="round" >
      <Text dimColor={true}>{output}</Text>
    </Box>
  }
  renderTask(taskInfo, <TaskOutput />);

  await promise;
  return fnResult;
}

function addToRender(comp) {
  activeComponents.push(comp);
  activeTasks.push(comp.props.taskInfo);
    
  if (activeComponents.length < 2) {
    render(comp);
    return;
  }
  render(<Box flexDirection='row' gap={1}>
    {activeComponents}
  </Box>);
}

function removeFromRender(taskInfo) {
  activeTasks = activeTasks.filter((ti) => ti?.id !== taskInfo?.id);

  if (activeTasks.length === 0) {
    clearRenderer();
    activeComponents = [];
    return;
  }
}

export const renderTask = async (taskInfo, children) => {
  if (tasksExecuted.map(t => t.id).includes(taskInfo.id)) return; // alraday executed

  tasksExecuted.push(taskInfo);
  addToRender(<Task key={`${tasksExecuted.length}_${taskInfo}`} taskInfo={taskInfo}>{children}</Task>);
};


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

  return (<Box flexGrow={1} flexBasis="50%" flexDirection='column'>
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
    return <>  
      <Text bold>{this.kind}</Text>
      <Text color='yellow'>{this.text}</Text>
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
