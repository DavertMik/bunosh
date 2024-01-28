#!/usr/bin/env bun
import { bunosh } from "./index";

/**
 * Hello world
 * @param {*} arg1
 * @param {*} opts
 */
export function helloWorld(
  arg1,
  opts = { user: null, val: "ok", flag: false },
) {
  console.log("Hello World!", arg1);
}

/**
 * Hello other
 */
export function helloOther() {
  // this is ok
}

/**
 * Deploys code to staging
 */
export function updateToProduction() {}

/**
 * Deploys code to production
 */
export function updateToStaging() {
  // this is not ok
}
