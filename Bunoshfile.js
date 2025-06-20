#!/usr/bin/env bun
import { exec, fetch, task, ignoreFail } from "./index";
import { ask, say, yell } from "./src/io";
import fs from "fs";
import writeToFile from "./src/tasks/writeToFile";

/**
 * Builds binary file for Bunosh
 */
export async function buildBinary() {
  await exec`bun build ./bunosh.js --compile --outfile bunosh`;
}

export async function buildDocker() {
  ignoreFail(true);
  // process.chdir('/home/davert/projects/testomatio/frontend')

  // await exec`yarn build`.cwd('/home/davert/projects/testomatio/frontend');
  await exec`docker build .`.cwd('/home/davert/projects/testomatio/frontend');;
}

/**
 * 🎉 Hello world
 * @param {*} arg1
 * @param {*} opts
 */
export async function helloWorld(
  arg1,
  opts = { user: null, val: "ok", flag: false },
) {
  // console.log("Hello World!", arg1);
  yell("I need all git status");
  const pack = await task('read file', () => {
    return fs.readFileSync("package.json").toString();
  });
  writeToFile('test.txt', l => {
    l`lock file`
    l('Hello world');
    l.fromFile('package.json');
  });
  yell('done');
  yell('ok');
}

/**
 * Hello other
 */
export async function helloOther(opts = {
  user: null,
  val: "ok",
  flag: false
}) {

  // yell('running everything!')

  await fetch('https://reqres.in/api/users')

  await Promise.all([
    fetch('https://reqres.in/api/users/1'),
    exec`ps aux | grep redis`,
    fetch('https://reqres.in/api/users/2')
  ])

  // ignoreFail(true);

  await exec`ps aux | grep node`;
  // await exec`git status`.cwd('/home/davert/projects/codeceptjs');
}

/**
 * Deploys code to staging
*/
export async function updateToProduction(env) {

  await Promise.all([
    exec`ps aux | grep redis`,
    exec`ps aux | grep clickhouse`,
    fetch('https://reqres.in/api/users/2'),
  ])
}

/**
 * Deploys code to production
 */
export async function updateToStaging() {
  // this is not ok
  const env = await ask('Which environment we are in?');
  say(env);
}

/**
 * Test streaming output
 */
export async function testStreaming() {
  // Command that produces output over time
  await exec`sh -c 'for i in 1 2 3 4 5; do echo "Line $i"; sleep 0.5; done'`;
}

/**
 * Test live output validation
 */
export async function testLiveOutput() {
  console.log("Testing live output with no artifacts and no duplicates...\n");
  
  // Test with a command that produces clear, timed output
  await exec`sh -c 'echo "Step 1: Starting"; sleep 0.3; echo "Step 2: Processing"; sleep 0.3; echo "Step 3: Almost done"; sleep 0.3; echo "Step 4: Complete"'`;
  
  console.log("\n--- Test completed ---");
}
