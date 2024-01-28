import program from "./src/program";
import { readFileSync } from "fs";

const tasksFile = "./tasks.js";

import(tasksFile).then((tasks) => {
  program(tasks, readFileSync(tasksFile, "utf-8"));
});
