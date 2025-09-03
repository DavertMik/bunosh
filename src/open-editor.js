import { spawn } from 'child_process';
import path from 'path';

export default function openEditor(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Files array is required and cannot be empty');
  }

  const editor = options.editor || getDefaultEditor();
  const fileArgs = buildEditorArgs(editor, files);

  return new Promise((resolve, reject) => {
    const child = spawn(editor, fileArgs, {
      stdio: 'inherit',
      detached: true
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to open editor '${editor}': ${err.message}`));
    });

    child.on('spawn', () => {
      resolve();
    });

    if (child.pid) {
      child.unref();
    }
  });
}

function getDefaultEditor() {
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  const editors = ['code', 'subl', 'atom', 'vim', 'nvim', 'nano', 'gedit'];
  
  for (const editor of editors) {
    if (isCommandAvailable(editor)) {
      return editor;
    }
  }

  return process.platform === 'win32' ? 'notepad' : 'vi';
}

function isCommandAvailable(command) {
  try {
    const { execSync } = require('child_process');
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildEditorArgs(editor, files) {
  const editorName = path.basename(editor);
  const args = [];

  for (const fileInfo of files) {
    const filePath = typeof fileInfo === 'string' ? fileInfo : fileInfo.file;
    
    if (!filePath) {
      continue;
    }

    if (fileInfo.line && typeof fileInfo === 'object') {
      switch (editorName) {
        case 'code':
        case 'code-insiders':
          args.push('--goto', `${filePath}:${fileInfo.line}:${fileInfo.column || 1}`);
          break;
        case 'subl':
        case 'sublime_text':
          args.push(`${filePath}:${fileInfo.line}:${fileInfo.column || 1}`);
          break;
        case 'vim':
        case 'nvim':
          args.push(`+${fileInfo.line}`, filePath);
          break;
        case 'nano':
          args.push(`+${fileInfo.line}`, filePath);
          break;
        default:
          args.push(filePath);
      }
    } else {
      args.push(filePath);
    }
  }

  return args;
}