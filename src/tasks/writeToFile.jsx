import path from 'path';
import fs from 'fs';
import { task } from '../task.jsx';

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

  task(`write to file ${fileName}`, () => {

    if (lineBuilderFn instanceof Function) {
      lineBuilderFn(fileLine);
    } else {
      text += lineBuilderFn;
    }
    setTimeout(() => {
      fs.writeFileSync(fileName, text);
    }, 0);
    // render text first before writing to file
    return text;
  });

  return text;
}




