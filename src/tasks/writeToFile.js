import path from 'path';
import fs from 'fs';
import Printer from '../printer.js';
import { createTaskInfo, finishTaskInfo } from '../task.js';

export default function writeToFile(fileName, lineBuilderFn) {
  let text = '';

  const fileLine = function(strings, ...values) {
    if (strings instanceof Array) {
      const line = strings.reduce((accumulator, str, i) => {
        return accumulator + str + (values[i] || '');
      }, '');
      text += `${line}\n`;
      return;
    }

    text += `${strings}\n`;
  }

  fileLine.fromFile = function(file) {
    text += fs.readFileSync(path.join(process.cwd(), file));
  }

  fileLine.currentFile = function() {
    text += fs.readFileSync(path.join(process.cwd(), fileName));
  }

  const taskInfo = createTaskInfo(fileName);
  const printer = new Printer('writeToFile', taskInfo.id);
  
  try {
    printer.start(fileName);
    
    if (lineBuilderFn instanceof Function) {
      lineBuilderFn(fileLine);
    } else {
      text += lineBuilderFn;
    }
    
    fs.writeFileSync(fileName, text);
    printer.finish(fileName, { characters: text.length });
    finishTaskInfo(taskInfo, true, null, `${text.length} characters`);
  } catch (error) {
    printer.error(fileName, error);
    finishTaskInfo(taskInfo, false, error, error.message);
    throw error;
  }

  return text;
}