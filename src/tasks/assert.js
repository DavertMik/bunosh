import { createTaskInfo, finishTaskInfo, getCurrentTaskId, runningTasks, isStopOnFailuresMode, isTestEnv } from '../task.js';
import Printer from '../printer.js';

export default function assert(condition, message = 'Assertion failed') {
  const currentTaskId = getCurrentTaskId();
  const parent = currentTaskId ? runningTasks.get(currentTaskId) : null;
  const isParentSilent = parent?.isSilent || false;

  const taskInfo = createTaskInfo(message, currentTaskId, isParentSilent);
  const printer = new Printer('assert', taskInfo.id);

  if (condition) {
    printer.finish(message);
    finishTaskInfo(taskInfo, true, null, message);
    return;
  }

  const error = new Error(message);
  printer.error(message, error);
  finishTaskInfo(taskInfo, false, error, message);

  if (isStopOnFailuresMode() && !isTestEnv()) process.exit(1);
}
