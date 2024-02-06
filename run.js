
import program, { BUNOSHFILE, banner }  from "./src/program";
import { existsSync, readFileSync } from "fs";
import init from "./src/init";
import { say, yell } from './io';

const tasksFile = `./${BUNOSHFILE}`;

if (!existsSync(tasksFile)) {
  console.log(banner);

  if (process.argv.includes('init')) {
    init();
    process.exit(0);
  }

  console.log();
  console.error(`Bunosh file not found: ${tasksFile}`);
  console.log("Run `bunosh init` to create a new bunosh tasks file here")
  console.log();
  process.ar
  process.exit(1);
}

global.say = say;
global.yell = yell;

import(tasksFile).then((tasks) => {
  program(tasks, readFileSync(tasksFile, "utf-8"));
});
