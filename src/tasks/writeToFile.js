import path from 'path';
import fs from 'fs';
import Printer from '../printer.js';
import { registerTaskExecution } from '../task.js';

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

  const printer = new Printer('writeToFile');
  
  try {
    printer.start(fileName);
    
    if (lineBuilderFn instanceof Function) {
      lineBuilderFn(fileLine);
    } else {
      text += lineBuilderFn;
    }
    
    fs.writeFileSync(fileName, text);
    printer.finish(fileName, { characters: text.length });
    registerTaskExecution(fileName, true);
  } catch (error) {
    printer.error(fileName, error);
    registerTaskExecution(fileName, false, error);
    throw error;
  }

  return text;
}