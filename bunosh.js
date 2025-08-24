#!/usr/bin/env bun
import program, { BUNOSHFILE, banner }  from "./src/program.js";
import { existsSync, readFileSync, statSync } from "fs";
import init from "./src/init.js";
import path from "path";
import './index.js';

// Parse --bunoshfile flag before importing tasks
const bunoshfileIndex = process.argv.indexOf('--bunoshfile');
let customBunoshfile = null;
if (bunoshfileIndex !== -1 && bunoshfileIndex + 1 < process.argv.length) {
  customBunoshfile = process.argv[bunoshfileIndex + 1];
  // Remove the flag and its value from process.argv so it doesn't interfere with command parsing
  process.argv.splice(bunoshfileIndex, 2);
}

let tasksFile;
if (customBunoshfile) {
  const resolvedPath = path.isAbsolute(customBunoshfile) ? customBunoshfile : path.resolve(customBunoshfile);
  // If it's a directory, append the default BUNOSHFILE
  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    tasksFile = path.join(resolvedPath, BUNOSHFILE);
    // Change working directory to the bunoshfile directory
    process.chdir(resolvedPath);
  } else {
    tasksFile = resolvedPath;
    // Change working directory to the bunoshfile's directory
    process.chdir(path.dirname(resolvedPath));
  }
} else {
  tasksFile = path.join(process.cwd(), BUNOSHFILE);
}

if (!existsSync(tasksFile)) {
  console.log(banner);

  if (process.argv.includes('init')) {
    init();
    process.exit(0);
  }

  console.log();
  console.error(`Bunoshfile not found: ${tasksFile}`);
  console.log(customBunoshfile ? 
    `Run \`bunosh init\` in the directory or specify a valid --bunoshfile path` :
    "Run `bunosh init` to create a new Bunoshfile here")
  console.log();
  process.exit(1);
}

import(tasksFile).then((tasks) => {
  program(tasks, readFileSync(tasksFile, "utf-8"));
}).catch((e) => {
  console.error(`Error loading: ${tasksFile}`);
  console.error(e);
});
