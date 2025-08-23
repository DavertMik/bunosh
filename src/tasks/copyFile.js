const { copySync } = require('fs-extra');
import Printer from '../printer.js';
import { registerTaskExecution } from '../task.js';

export default function copyFile(src, dst) {
  const printer = new Printer('copyFile');
  const taskName = `${src} ⇒ ${dst}`;
  
  try {
    printer.start(taskName);
    copySync(src, dst);
    printer.finish(taskName);
    registerTaskExecution(taskName, true);
  } catch (error) {
    printer.error(taskName, error);
    registerTaskExecution(taskName, false, error);
    throw error;
  }
}