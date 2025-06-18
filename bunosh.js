#!/usr/bin/env bun
import program, { BUNOSHFILE, banner }  from "./src/program";
import { existsSync, readFileSync } from "fs";
import init from "./src/init";
import path from "path";
import './index';

const tasksFile = path.join(process.cwd(), BUNOSHFILE);

if (!existsSync(tasksFile)) {
  console.log(banner);

  if (process.argv.includes('init')) {
    init();
    process.exit(0);
  }

  console.log();
  console.error(`Bunoshfile not found: ${tasksFile}`);
  console.log("Run `bunosh init` to create a new Bunoshfile here")
  console.log();
  process.exit(1);
}

import(tasksFile).then((tasks) => {
  program(tasks, readFileSync(tasksFile, "utf-8"));
}).catch((e) => {
  console.error(`Error loading: ${tasksFile}`);
  console.error(e);
});
