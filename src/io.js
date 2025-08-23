import inquirer from 'inquirer';
import chalk from 'chalk';

export function say(...args) {
  console.log('!', ...args);
}

export async function ask(question, opts = {}) {
  const answers = await inquirer.prompt({ name: question, message: question, ...opts })
  return Object.values(answers)[0];
}

export function yell(text) {
  console.log();
  console.log(chalk.bold.yellow(text.toUpperCase()));
  console.log();
}