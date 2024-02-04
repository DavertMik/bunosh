import { render as inkRender } from 'ink';
import debug from 'debug';

export const isStaticOutput = process.env.CI || process.env.DEBUG || !process.stdout.isTTY;

if (isStaticOutput) debug.enable('bunosh:*');

let renderer = null;

export function render(comp = <></>) {
  
  if (!renderer) {
    renderer = inkRender(comp);
    return renderer;
  }

  renderer.rerender(comp);
  return renderer;
}

export function renderOnce(comp) {
  render(comp);
  clearRenderer();
}

export function clearRenderer() {
  if (!renderer) return;
  renderer.unmount();
  renderer = null;
}


export function debugTask(task, line) {
  const ns = `bunosh:${task}`;
  debug(ns)(line);
}