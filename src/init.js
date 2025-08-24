import { BUNOSHFILE } from "./program.js";
import color from "chalk";
import fs from 'fs';

const template = `
// tasks
const { exec, fetch, writeToFile, task } = global.bunosh;

// input/output
const { say, ask, yell } = global.bunosh;

/**
 * 🎉 Hello world command
 */
export async function helloWorld() {
  // use say() to print to the console
  // say('Hello World!');

  // use exec\`\` to execute shell scripts:
  // await exec\`git status\`

  // use fetch() to make HTTP requests
  // await fetch('https://reqres.in/api/users')

  // add arguments and options to this function if needed
  // export async function helloWorld(userName, opts = { force: false })
  //
  // bunosh hello:world 'bob' --force

  // use ignoreFail(true) to prevent the command from stopping on error

  yell('Heloo Bunosh!');
  say('Edit me with bunosh edit');
}
`;

export default function init() {
  if (!fs.existsSync(BUNOSHFILE)) {
    Bun.write(BUNOSHFILE, template);
    console.log(color.bold(`🎉 Bunosh ${BUNOSHFILE} file created`));
    console.log('   Edit it with "bunosh edit" command');
    console.log('   Or open it in your favorite editor');
    return;
  }

  console.error(`Bunosh file already exists: ${BUNOSHFILE}`);
}
