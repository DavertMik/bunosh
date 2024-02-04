import React, {useState, useEffect} from 'react';
import { Text, Box, Static } from 'ink';
import Spinner from 'ink-spinner';
import { Timer } from 'timer-node';
import { render, clearRenderer } from './output';

export const TaskStatus = {  
  RUNNING: 'running',
  FAIL: 'fail',
  SUCCESS: 'success'
};

export const tasksExecuted = [];

let activeComponents = [];
let activeTasks = [];

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
  }

  useEffect(() => {    
    promise.then((result) => {
      updateTaskInfo(result)
    }).catch((err) => {
      updateTaskInfo(TaskResult.fail(err.toString()));
    });
  }, []);

  return (<Box flexGrow={1}  flexBasis="50%" flexDirection='column'>
      <Box gap={1} flexDirection='row' alignItems='flex-start' justifyContent="flex-start">
        <Status taskStatus={status} />

        {taskInfo.titleComponent}

        {time === null && <Spinner />}
        {time !== null && <Text dimColor={true}>{time}ms</Text>}
        
      </Box>

      {children}
      </Box>
  );
};

export class TaskInfo {
  constructor({ promise, kind, text }) {
    this.id = `${kind}-${text.slice(0,30).replace(/\s/g, '-')}-${Math.random().toString(36).substring(7)}`;
    this.kind = kind;
    this.text = text;
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
