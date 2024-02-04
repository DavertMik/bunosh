#!/usr/bin/env bun
import { exec, fetch, task, ignoreFail } from "./index";
import { ask, say, yell } from "./io";
import fs from "fs";

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
  say(pack);
  yell('done');
  yell('ok');
}

/**
 * Hello other
 */
export async function helloOther() {
  
  yell('running everything!')

  await fetch('https://reqres.in/api/users')

  await Promise.all([
    fetch('https://reqres.in/api/users/1'),
    exec`ps aux | grep redis`,
    fetch('https://reqres.in/api/users/2')
  ])

  ignoreFail(true);

  await exec`ps aux | grep node`,
  await exec`git status`.cwd('/home/davert/projects/codeceptjs');
}

/**
 * Deploys code to staging
*/
export async function updateToProduction() {
  
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

