import { TaskResult, registerTaskExecution } from '../task.js';
import Printer from '../printer.js';

export default async function httpFetch() {
  const url = arguments[0];
  const method = arguments[1]?.method || 'GET';
  const taskName = `${method} ${url}`;
  
  const printer = new Printer('fetch');
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
            printer.print(line, 'output');
            output += line + '\n';
          }
        }
      }
    }

    if (response.ok) {
      printer.finish(taskName, { status: `${response.status} ${response.statusText}` });
      registerTaskExecution(taskName, true);
      return TaskResult.success(output.trim());
    } else {
      const errorMsg = `HTTP ${response.status} ${response.statusText}`;
      printer.error(taskName, errorMsg);
      registerTaskExecution(taskName, false, new Error(errorMsg));
      return TaskResult.fail(errorMsg);
    }
    
  } catch (error) {
    printer.error(taskName, error);
    registerTaskExecution(taskName, false, error);
    return TaskResult.fail(error.message);
  }
}