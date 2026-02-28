import { codeFrameColumns } from "@babel/code-frame";
import { readFileSync, existsSync } from "fs";
import path from "path";
import color from "chalk";

function parseErrorLocation(error) {
  if (!error.stack) return null;

  const lines = error.stack.split('\n');
  for (const line of lines) {
    const match = line.match(/at .+? \((.+?):(\d+):(\d+)\)/) ||
                  line.match(/at (.+?):(\d+):(\d+)/);
    if (!match) continue;

    const file = match[1];
    if (file.includes('node_modules/') || file.startsWith('node:')) continue;

    return {
      file,
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    };
  }

  return null;
}

function cleanStack(error) {
  if (!error.stack) return '';

  return error.stack
    .split('\n')
    .filter(line => {
      if (!line.trim().startsWith('at ')) return false;
      if (line.includes('node_modules/')) return false;
      if (line.includes('node:')) return false;
      return true;
    })
    .join('\n');
}

export function formatError(error) {
  const loc = parseErrorLocation(error);
  const parts = [];

  if (loc) {
    const displayFile = path.relative(process.cwd(), loc.file) || loc.file;
    parts.push(color.red.bold('Error') + ` in ${color.bold(displayFile + ':' + loc.line)}`);
  } else {
    parts.push(color.red.bold('Error'));
  }

  parts.push(`   ${error.message}`);

  if (loc) {
    const absFile = path.isAbsolute(loc.file) ? loc.file : path.resolve(process.cwd(), loc.file);
    if (existsSync(absFile)) {
      try {
        const source = readFileSync(absFile, 'utf-8');
        const frame = codeFrameColumns(source, {
          start: { line: loc.line, column: loc.column },
        }, {
          highlightCode: true,
          linesAbove: 2,
          linesBelow: 1,
        });
        parts.push('');
        parts.push(frame);
      } catch {}
    }
  }

  const stack = cleanStack(error);
  if (stack) {
    parts.push('');
    parts.push(stack);
  }

  return parts.join('\n');
}
