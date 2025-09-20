import { TaskResult, createTaskInfo, finishTaskInfo, getCurrentTaskId } from '../task.js';
import Printer from '../printer.js';

export default async function httpFetch() {
  const url = arguments[0];
  const method = arguments[1]?.method || 'GET';
  const taskName = `${method} ${url}`;
  
  const currentTaskId = getCurrentTaskId();
  const taskInfo = createTaskInfo(taskName, currentTaskId);
  const printer = new Printer('fetch', taskInfo.id);
  printer.start(taskName);

  try {
    const response = await fetch(...arguments);
    const textDecoder = new TextDecoder();
    let output = '';

    if (response.body) {
      for await (const chunk of response.body) {
        const lines = textDecoder.decode(chunk, { stream: true }).toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            printer.output(line);
            output += line + '\n';
          }
        }
      }
    }

    const metadata = {
      taskType: 'fetch',
      response: response.clone(), // Clone to allow json() to be called later
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    };

    if (response.ok) {
      printer.finish(taskName, { status: `${response.status} ${response.statusText}` });
      finishTaskInfo(taskInfo, true, null, output.trim());
      return TaskResult.success(output.trim(), metadata);
    } else {
      const errorMsg = `HTTP ${response.status} ${response.statusText}`;
      const error = new Error(errorMsg);
      printer.error(taskName, errorMsg);
      finishTaskInfo(taskInfo, false, error, errorMsg);
      return TaskResult.fail(errorMsg, metadata);
    }
    
  } catch (error) {
    printer.error(taskName, error);
    finishTaskInfo(taskInfo, false, error, error.message);
    return TaskResult.fail(error.message, { taskType: 'fetch' });
  }
}