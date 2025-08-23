const { copySync } = require('fs-extra');
import Printer from '../printer.js';
import { createTaskInfo, finishTaskInfo } from '../task.js';

export default function copyFile(src, dst) {
  const taskName = `${src} ⇒ ${dst}`;
  const taskInfo = createTaskInfo(taskName);
  const printer = new Printer('copyFile', taskInfo.id);
  
  try {
    printer.start(taskName);
    copySync(src, dst);
    printer.finish(taskName);
    finishTaskInfo(taskInfo, true, null, 'File copied');
  } catch (error) {
    printer.error(taskName, error);
    finishTaskInfo(taskInfo, false, error, error.message);
    throw error;
  }
}