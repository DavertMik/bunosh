import inquirer from 'inquirer';
import chalk from 'chalk';
import cprint from './font.js';

export function say(...args) {
  console.log('○', ...args);
}

export async function ask(question, defaultValueOrOptions = {}, options = {}) {
  // Check if we're in MCP mode and should use the interactive ask function
  if (globalThis._mcpAskFunction) {
    return globalThis._mcpAskFunction(question, defaultValueOrOptions, options);
  }

  // Track that we're in an ask operation to prevent duplicate exit summaries
  globalThis._bunoshInAskOperation = true;
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
  
  try {
    const answers = await inquirer.prompt({ name: question, message: question, ...opts })
    return Object.values(answers)[0];
  } finally {
    // Reset ask operation flag
    globalThis._bunoshInAskOperation = false;
  }
}

async function askWithEditor(question, opts = {}) {
  globalThis._bunoshInAskOperation = true;
  try {
    const answers = await inquirer.prompt({
      name: question,
      message: question,
      type: 'editor',
      ...opts
    });
    return Object.values(answers)[0];
  } finally {
    globalThis._bunoshInAskOperation = false;
  }
}

async function askWithChoices(question, opts = {}) {
  globalThis._bunoshInAskOperation = true;
  const promptType = opts.multiple ? 'checkbox' : 'list';
  
  try {
    const answers = await inquirer.prompt({
      name: question,
      message: question,
      type: promptType,
      choices: opts.choices,
      ...opts
    });
    
    return Object.values(answers)[0];
  } finally {
    globalThis._bunoshInAskOperation = false;
  }
}

export function yell(text) {
  // Always use boxed capitalized format
  const upperText = text.toUpperCase();
  const boxText = createBoxedText(upperText);
  console.log(boxText);
}

function createGradientAscii(asciiArt) {
  const lines = asciiArt.split('\n');
  const colors = [
    chalk.bold.yellow,
    chalk.bold.green,
    chalk.bold.greenBright,
    chalk.bold.cyan,
    chalk.bold.blue
  ];
  
  return lines.map((line, index) => {
    // Create smooth gradient by interpolating between colors
    const progress = index / (lines.length - 1);
    const colorIndex = progress * (colors.length - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    const factor = colorIndex - lowerIndex;
    
    // For smoother transition, we'll use the closest color
    const color = factor < 0.5 ? colors[lowerIndex] : colors[upperIndex];
    return color(line);
  }).join('\n');
}

function createBoxedText(text) {
  const maxLength = Math.max(text.length, 10);
  const totalWidth = maxLength + 6; // 6 = 3 spaces padding on each side
  const leftPadding = Math.floor((totalWidth - text.length) / 2);
  const rightPadding = totalWidth - text.length - leftPadding;
  
  // Use Unicode box drawing characters for a nice look
  const topLeft = '╭';
  const topRight = '╮';
  const bottomLeft = '╰';
  const bottomRight = '╯';
  const horizontal = '─';
  const vertical = '│';
  
  const horizontalBorder = topLeft + horizontal.repeat(totalWidth) + topRight;
  const emptyLine = vertical + ' '.repeat(totalWidth) + vertical;
  const textLine = vertical + ' '.repeat(leftPadding) + chalk.bold(text) + ' '.repeat(rightPadding) + vertical;
  
  return [
    chalk.bold.cyan(horizontalBorder),
    chalk.cyan(emptyLine),
    chalk.cyan(emptyLine),
    chalk.cyan(textLine),
    chalk.cyan(emptyLine),
    chalk.cyan(emptyLine),
    chalk.bold.cyan(bottomLeft + horizontal.repeat(totalWidth) + bottomRight)
  ].join('\n');
}
