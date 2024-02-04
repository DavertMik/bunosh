#!/usr/bin/env bun
import { exec, fetch } from "./index";
import { ask, say, yell } from "./io";

/**
 * 🎉 Hello world
 * @param {*} arg1
 * @param {*} opts
 */
export function helloWorld(
  arg1,
  opts = { user: null, val: "ok", flag: false },
) {
  // console.log("Hello World!", arg1);
  yell("I need all git status");
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
  
  await exec`ps aux`;
  await exec`ps aux | grep node`,
  await exec`git status`;
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
  await ask('Which environment we are in?');
}

