import { BUNOSHFILE, banner } from "./program.js";
import color from "chalk";
import fs from 'fs';

const template = `
// Bunosh CLI required to execute tasks from this file
// Get it here => https://buno.sh

const { exec, shell, fetch, writeToFile, task, ai } = global.bunosh;

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

  // use ai() to make AI requests with structured output:
  // REQUIRED env vars: AI_MODEL and any of: OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY
  // await ai('Summarize this text: JavaScript is awesome', {
  //   summary: 'Brief summary of the text',
  //   sentiment: 'Sentiment of the text (positive/negative/neutral)',
  //   keyWords: 'Main keywords from the text'
  // });

  // add arguments and options to this function if needed
  // export async function helloWorld(userName, opts = { force: false })
  //
  // bunosh hello:world 'bob' --force

  yell('Heloo Bunosh!');
  say('Edit me with bunosh edit');
}
`;

export default function init() {
  if (!fs.existsSync(BUNOSHFILE)) {
    // Use fs.writeFileSync for Node.js compatibility instead of Bun.write
    if (typeof Bun !== 'undefined') {
      Bun.write(BUNOSHFILE, template);
    } else {
      fs.writeFileSync(BUNOSHFILE, template, 'utf8');
    }
    console.log(color.bold(`🎉 Bunosh ${BUNOSHFILE} file created`));
    console.log('   Edit it with "bunosh edit" command');
    console.log('   Or open it in your favorite editor');
    return;
  }

  console.error(`Bunosh file already exists: ${BUNOSHFILE}`);
}
