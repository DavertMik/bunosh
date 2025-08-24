import inquirer from 'inquirer';
import chalk from 'chalk';
import cprint from './font.js';

export function say(...args) {
  console.log('!', ...args);
}

export async function ask(question, opts = {}) {
  const answers = await inquirer.prompt({ name: question, message: question, ...opts })
  return Object.values(answers)[0];
}

export function yell(text) {
  console.log();

  console.log(chalk.bold.yellow(cprint(text, { symbol: '■' })));

  console.log();
}
