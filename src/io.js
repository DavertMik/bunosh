import inquirer from 'inquirer';
import chalk from 'chalk';
import cprint from './font.js';

export function say(...args) {
  console.log('!', ...args);
}

export async function ask(question, defaultValueOrOptions = {}, options = {}) {
  // Smart parameter detection
  let opts = {};
  
  // If second parameter is not an object, it's a default value
  if (defaultValueOrOptions !== null && typeof defaultValueOrOptions !== 'object') {
    opts.default = defaultValueOrOptions;
    opts = { ...opts, ...options }; // Merge with third parameter options
    
    // Auto-detect type based on default value
    if (typeof defaultValueOrOptions === 'boolean') {
      opts.type = 'confirm';
    }
  } else if (Array.isArray(defaultValueOrOptions)) {
    // If it's an array, treat as choices
    opts.choices = defaultValueOrOptions;
    opts = { ...opts, ...options }; // Merge with third parameter options
  } else {
    // Traditional object parameter
    opts = { ...defaultValueOrOptions, ...options };
  }
  
  // Route to appropriate handler based on options
  if (opts.editor || opts.multiline) {
    return await askWithEditor(question, opts);
  }
  
  if (opts.choices) {
    return await askWithChoices(question, opts);
  }
  
  const answers = await inquirer.prompt({ name: question, message: question, ...opts })
  return Object.values(answers)[0];
}

async function askWithEditor(question, opts = {}) {
  const answers = await inquirer.prompt({
    name: question,
    message: question,
    type: 'editor',
    ...opts
  });
  return Object.values(answers)[0];
}

async function askWithChoices(question, opts = {}) {
  const promptType = opts.multiple ? 'checkbox' : 'list';
  
  const answers = await inquirer.prompt({
    name: question,
    message: question,
    type: promptType,
    choices: opts.choices,
    ...opts
  });
  
  return Object.values(answers)[0];
}

export function yell(text) {
  console.log();

  console.log(chalk.bold.yellow(cprint(text, { symbol: '■' })));

  console.log();
}
