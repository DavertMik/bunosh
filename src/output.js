import React from 'react';
import { render as inkRender } from 'ink';
import debug from 'debug';
import { Writable } from 'stream';

export const isStaticOutput = process.env.CI || (process.env.DEBUG && !process.env.FORCE_RICH_UI) || (!process.stdout.isTTY && !process.env.FORCE_RICH_UI) || process.env.TEST_STATIC;

// Only enable debug logging when explicitly requested
if (process.env.DEBUG && process.env.DEBUG.includes('bunosh')) {
  debug.enable('bunosh:*');
}

let renderers = [];

export function render(comp = <></>, rendererId = 'default') {
  let renderer = renderers.find(r => r.id === rendererId);
  
  if (!renderer) {
    // Add debug marker for new renderer creation
    if (process.env.DEBUG?.includes('bunosh')) {
      console.log(`🎬 Creating renderer: ${rendererId}`);
    }
    
    // Create renderer with options to minimize artifacts
    const renderOptions = {
      // Try to minimize initial output
      patchConsole: false,
      exitOnCtrlC: false
    };
    
    renderer = {
      id: rendererId,
      instance: inkRender(comp, renderOptions)
    };
    renderers.push(renderer);
    return renderer.instance;
  }

  // Add debug marker for re-render
  if (process.env.DEBUG?.includes('bunosh')) {
    console.log(`🔄 Re-rendering: ${rendererId}`);
  }
  renderer.instance.rerender(comp);
  return renderer.instance;
}

export async function renderOnce(comp) {
  const defaultRenderer = renderers.find(r => r.id === 'default');
  if (defaultRenderer) await defaultRenderer.instance.waitUntilExit();
  render(comp);
  clearRenderer();
}

export function destroyRenderer(rendererId) {
  const index = renderers.findIndex(r => r.id === rendererId);
  if (index !== -1) {
    if (process.env.DEBUG?.includes('bunosh')) {
      console.log(`💥 Destroying renderer: ${rendererId}`);
    }
    const renderer = renderers[index];
    
    // Unmount to convert to static terminal output
    renderer.instance.unmount();
    renderers.splice(index, 1);
  }
}

export function clearRenderer(rendererId = null) {
  if (rendererId) {
    const index = renderers.findIndex(r => r.id === rendererId);
    if (index !== -1) {
      if (process.env.DEBUG?.includes('bunosh')) {
        console.log(`🧹 Clearing renderer: ${rendererId}`);
      }
      renderers[index].instance.unmount();
      renderers.splice(index, 1);
    }
  } else {
    // Clear all renderers
    if (process.env.DEBUG?.includes('bunosh')) {
      console.log(`🧹 Clearing ALL renderers (${renderers.length})`);
    }
    renderers.forEach(r => r.instance.unmount());
    renderers = [];
  }
}

export function forceTerminalCleanup() {
  // Clear all renderers and force complete terminal reset
  renderers.forEach(r => r.instance.unmount());
  renderers = [];
  
  // Just clear any remaining cursor artifacts, don't clear whole screen
  process.stdout.write('\x1b[0m'); // Reset colors and formatting
}

// Create a writable stream that captures output to a string
class StringStream extends Writable {
  constructor() {
    super();
    this.content = '';
  }
  
  _write(chunk, encoding, callback) {
    this.content += chunk.toString();
    callback();
  }
  
  getString() {
    return this.content;
  }
}

export async function renderToString(comp) {
  const stringStream = new StringStream();
  
  // Create a minimal stdin stream for Ink
  const mockStdin = new Writable({
    write() { return true; }
  });
  
  // Detect terminal dimensions to match live rendering
  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;
  
  // Create a custom stdout stream that reports the correct terminal size
  class TerminalSizeStringStream extends StringStream {
    get columns() {
      return terminalWidth;
    }
    
    get rows() {
      return terminalHeight;
    }
    
    get isTTY() {
      return true; // Pretend to be a TTY for proper formatting
    }
  }
  
  const terminalSizedStream = new TerminalSizeStringStream();
  
  // Render to our string stream with proper terminal dimensions
  const instance = inkRender(comp, {
    stdout: terminalSizedStream,
    stdin: mockStdin,
    stderr: terminalSizedStream,
    patchConsole: false
  });
  
  // Wait a bit for rendering to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Get the rendered output as string
  let output = terminalSizedStream.getString();
  
  // Clean up
  instance.unmount();
  
  // Trim excessive blank lines and whitespace
  output = output
    .split('\n')
    .map(line => line.trimEnd()) // Remove trailing spaces from each line
    .filter((line, index, arr) => {
      // Remove excessive consecutive empty lines - keep max 1 empty line
      if (line === '') {
        return index === 0 || index === arr.length - 1 || arr[index - 1] !== '';
      }
      return true;
    })
    .join('\n')
    .trim(); // Remove leading/trailing whitespace
  
  return output;
}


export function debugTask(task, line) {
  const ns = `bunosh:${task}`;
  debug(ns)(line);
}