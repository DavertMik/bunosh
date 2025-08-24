import inquirer from 'inquirer';
import chalk from 'chalk';
import cfonts from 'cfonts';

export function say(...args) {
  console.log('!', ...args);
}

export async function ask(question, opts = {}) {
  const answers = await inquirer.prompt({ name: question, message: question, ...opts })
  return Object.values(answers)[0];
}

export function yell(text) {
  cfonts.say(text.toUpperCase(), {
    font: 'block',
    align: 'left',
    colors: ['yellow'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true,
    maxLength: '0',
    gradient: false,
    independentGradient: false,
    transitionGradient: false,
    env: 'node'
  });
}