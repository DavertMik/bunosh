import { Command } from "commander";
import babelParser from "@babel/parser";
import traverseDefault from "@babel/traverse";
const traverse = traverseDefault.default || traverseDefault;
import color from "chalk";
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { yell } from './io.js';
import cprint from "./font.js";
import { handleCompletion, detectCurrentShell, installCompletion, getCompletionPaths } from './completion.js';
import { upgradeCommand } from './upgrade.js';

export const BUNOSHFILE = `Bunoshfile.js`;

export const banner = () => {
  const logoArt = 
`     .::=-=-___.        
   .:+*##*-**:___.       
 :**#%*-+#####*++*     
 :-+**++*########*+     
  \▒░░░░:----▒▒▒▒░/      
   \▒▒▒▒▒▒▒▒▒▒▒░░/       
    \▓▓▓▓▓▓▓▓░░░/        
     \▓▓▓▓▓▓░░░/   `;
  
  console.log(createGradientAscii(logoArt));

  let version = '';
  try {
    const pkgPath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    version = pkg.version;
  } catch (e) {
  }
  console.log(color.gray('🍲 ', color.yellowBright.bold('BUNOSH'), color.yellow(version)));

  console.log();
};

function createGradientAscii(asciiArt) {
  const lines = asciiArt.split('\n');
  
  // Yellow RGB (255, 220, 0) to Brown RGB (139, 69, 19)
  const startColor = { r: 255, g: 220, b: 0 };
  const endColor = { r: 139, g: 69, b: 19 };
  
  return lines.map((line, index) => {
    // Block characters should always be brown
    if (line.includes('░') || line.includes('▒') || line.includes('▓')) {
      return `\x1b[38;2;139;69;19m${line}\x1b[0m`;
    }
    
    // Create smooth gradient for other characters
    const progress = index / (lines.length - 1);
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * progress);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * progress);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * progress);
    
    // Use true color escape sequence
    return `\x1b[38;2;${r};${g};${b}m${line}\x1b[0m`;
  }).join('\n');
}

export default async function bunosh(commands, source) {
  const program = new Command();
  program.option('--bunoshfile <path>', 'Path to the Bunoshfile');

  const internalCommands = [];

  // Load npm scripts from package.json
  const npmScripts = loadNpmScripts();

  // Load personal commands from $HOME/Bunoshfile.js
  const { tasks: homeTasks, source: homeSource } = await loadHomeTasks();

  program.configureHelp({
    commandDescription: _cmd => {
      // Show banner and description
      banner();
      return `  Commands are loaded from exported functions in ${color.bold(BUNOSHFILE)}`;
    },
    commandUsage: usg => 'bunosh [-e <code>] <command> <args> [options]',
    showGlobalOptions: false,
    visibleGlobalOptions: _opt => [],
    visibleOptions: _opt => [],
    visibleCommands: cmd => {
      const commands = cmd.commands.filter(c => !internalCommands.includes(c));
      return commands.filter(c => !c.name().startsWith('npm:') && !c.name().startsWith('my:'));
    },
    subcommandTerm: (cmd) => color.white.bold(cmd.name()),
    subcommandDescription: (cmd) => color.gray(cmd.description()),
  });

  program.showHelpAfterError();
  program.showSuggestionAfterError(true);
  program.addHelpCommand(false);

  let completeAst;
  try {
    completeAst = babelParser.parse(source, {
      sourceType: "module",
      ranges: true,
      tokens: true,
      comments: true,
      attachComment: true,
    });
  } catch (parseError) {
    // Re-throw with more specific error information
    parseError.code = 'BABEL_PARSER_SYNTAX_ERROR';
    throw parseError;
  }

  const comments = fetchComments();
  const homeComments = fetchHomeComments();

  // Collect all commands (bunosh + personal commands + npm scripts) and sort them
  const allCommands = [];

  // Add bunosh commands
  Object.keys(commands).forEach((fnName) => {
    allCommands.push({ type: 'bunosh', name: fnName, data: commands[fnName] });
  });

  // Add personal commands with my: prefix
  Object.keys(homeTasks).forEach((fnName) => {
    if (typeof homeTasks[fnName] === 'function') {
      allCommands.push({ type: 'home', name: `my:${fnName}`, data: homeTasks[fnName], source: homeSource });
    }
  });

  // Add npm scripts
  Object.entries(npmScripts).forEach(([scriptName, scriptCommand]) => {
    allCommands.push({ type: 'npm', name: `npm:${scriptName}`, data: { scriptName, scriptCommand } });
  });

  // Sort all commands alphabetically by name
  allCommands.sort((a, b) => a.name.localeCompare(b.name));

  // Process all commands in sorted order
  allCommands.forEach((cmdData) => {
    if (cmdData.type === 'bunosh') {
      const fnName = cmdData.name;
      const fnBody = commands[fnName].toString();

      const ast = fetchFnAst();
      const args = parseArgs();
      const opts = parseOpts();

      const comment = comments[fnName];

      const commandName = prepareCommandName(fnName);

      const command = program.command(commandName);
      command.hook('preAction', (_thisCommand) => {
        process.env.BUNOSH_COMMAND_STARTED = true;
      })

      let argsAndOptsDescription = [];

      Object.entries(args).forEach(([arg, value]) => {
        if (value === undefined) {
          argsAndOptsDescription.push(`<${arg}>`);
          return command.argument(`<${arg}>`);
        }

        if (value === null) {
          argsAndOptsDescription.push(`[${arg}]`);
          return command.argument(`[${arg}]`, '', null);
        }

        argsAndOptsDescription.push(`[${arg}=${value}]`);
        command.argument(`[${arg}]`, ``, value);
      });

      Object.entries(opts).forEach(([opt, value]) => {
        if (value === false || value === null) {
          argsAndOptsDescription.push(`--${opt}`);
          return command.option(`--${opt}`);
        }

        argsAndOptsDescription.push(`--${opt}=${value}`);
        command.option(`--${opt} [${opt}]`, "", value);

      });

      let description = comment?.split('\n')[0] || '';

      if (comment && argsAndOptsDescription.length) description += `\n ▹ ${color.gray(`bunosh ${commandName}`)} ${color.blue(argsAndOptsDescription.join(' ').trim())}`;

      command.description(description);
      command.action(commands[fnName].bind(commands));

      function fetchFnAst() {
        let hasFnInSource = false;

        traverse(completeAst, {
          FunctionDeclaration(path) {
            if (path.node.id.name == fnName) {
              hasFnInSource = true;
              return;
            }
          },
        });

        if (hasFnInSource) return completeAst;

        return babelParser.parse(fnBody, { comment: true, tokens: true });
      }

      function parseArgs() {
        const functionArguments = {};

        traverse(ast, {
          FunctionDeclaration(path) {
            if (path.node.id.name !== fnName) return;

            const params = path.node.params
              .filter((node) => {
                return node?.right?.type !== "ObjectExpression";
              })
              .forEach((param) => {
                if (param.type === "AssignmentPattern") {
                  functionArguments[param.left.name] = param.right.value;
                  return;
                }
                if (!param.name) return;

                return functionArguments[param.name] = null;
              });

          },
        });

        return functionArguments;
      }

      function parseOpts() {
        let functionOpts = {};

        traverse(ast, {
          FunctionDeclaration(path) {
            if (path.node.id.name !== fnName) return;

            const node = path.node.params.pop();
            if (!node) return;
            if (
              !node.type === "AssignmentPattern" &&
              node.right.type === "ObjectExpression"
            )
              return;

            node?.right?.properties?.forEach((p) => {
              if (
                ["NumericLiteral", "StringLiteral", "BooleanLiteral"].includes(
                  p.value.type,
                )
              ) {
                functionOpts[camelToDasherize(p.key.name)] = p.value.value;
                return;
              }

              if (p.value.type === "NullLiteral") {
                functionOpts[camelToDasherize(p.key.name)] = null;
                return;
              }

              if (p.value.type == "UnaryExpression" && p.value.operator == "!") {
                functionOpts[camelToDasherize(p.key.name)] =
                  !p.value.argument.value;
                return;
              }
            });
          },
        });

        return functionOpts;
      }
    } else if (cmdData.type === 'home') {
      // Handle personal commands with my: prefix
      const originalFnName = cmdData.name.replace('my:', ''); // Remove my: prefix for internal usage
      const fnBody = cmdData.data.toString();
      const homeAst = fetchHomeFnAst(originalFnName, cmdData.source);
      const homeArgs = parseHomeArgs(originalFnName, homeAst);
      const homeOpts = parseHomeOpts(originalFnName, homeAst);
      const homeComment = homeComments[originalFnName];

      const commandName = cmdData.name; // Keep the full my: prefix for command name

      const command = program.command(commandName);
      command.hook('preAction', (_thisCommand) => {
        process.env.BUNOSH_COMMAND_STARTED = true;
      });

      let argsAndOptsDescription = [];

      Object.entries(homeArgs).forEach(([arg, value]) => {
        if (value === undefined) {
          argsAndOptsDescription.push(`<${arg}>`);
          return command.argument(`<${arg}>`);
        }

        if (value === null) {
          argsAndOptsDescription.push(`[${arg}]`);
          return command.argument(`[${arg}]`, '', null);
        }

        argsAndOptsDescription.push(`[${arg}=${value}]`);
        command.argument(`[${arg}]`, ``, value);
      });

      Object.entries(homeOpts).forEach(([opt, value]) => {
        if (value === false || value === null) {
          argsAndOptsDescription.push(`--${opt}`);
          return command.option(`--${opt}`);
        }

        argsAndOptsDescription.push(`--${opt}=${value}`);
        command.option(`--${opt} [${opt}]`, "", value);
      });

      let description = homeComment?.split('\n')[0] || '';

      if (homeComment && argsAndOptsDescription.length) {
        description += `\n  ${color.gray(`bunosh ${commandName}`)} ${color.blue(argsAndOptsDescription.join(' ').trim())}`;
      }

      command.description(description);
      command.action(cmdData.data.bind(homeTasks));
    } else if (cmdData.type === 'npm') {
      // Handle npm scripts
      const { scriptName, scriptCommand } = cmdData.data;
      const commandName = `npm:${scriptName}`;
      const command = program.command(commandName);
      command.description(color.gray(scriptCommand)); // Use script command as description

      // Create action with proper closure to capture scriptName
      command.action(createNpmScriptAction(scriptName));
    }
  });

  // Helper function to create npm script action with proper closure
  function createNpmScriptAction(scriptName) {
    return async () => {
      // Execute npm script using Bunosh's exec task
      const { exec } = await import('../index.js');
      try {
        // Call exec with proper template literal simulation
        const result = await exec(['npm run ', ''], scriptName);
        return result;
      } catch (error) {
        console.error(`Failed to run npm script: ${scriptName}`);
        process.exit(1);
      }
    };
  }

  const editCmd = program.command('edit')
    .description('Open the bunosh file in your editor. $EDITOR or \'code\' is used.')
    .action(async () => {
      if (!Bun) {
        console.log('Bun is not available');
        process.exit(1);
        return;
      }
      await Bun.openEditor([{
        file: BUNOSHFILE,
      }]);
    });

  internalCommands.push(editCmd);

  const exoprtCmd = program.command('export:scripts')
    .description('Export commands to "scripts" section of package.json.')
    .action(() => {
      exportFn(Object.keys(commands));
    });

  internalCommands.push(exoprtCmd);

  const completionCmd = program.command('completion <shell>')
    .description('Generate shell completion scripts')
    .argument('<shell>', 'Shell type: bash, zsh, or fish')
    .action((shell) => {
      try {
        const completionScript = handleCompletion(shell);
        console.log(completionScript);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });

  internalCommands.push(completionCmd);

  const setupCompletionCmd = program.command('setup-completion')
    .description('Automatically setup shell completion for your current shell')
    .option('-f, --force', 'Overwrite existing completion setup')
    .option('-s, --shell <shell>', 'Specify shell instead of auto-detection (bash, zsh, fish)')
    .action((options) => {
      try {
        // Detect current shell or use specified shell
        const shell = options.shell || detectCurrentShell();

        if (!shell) {
          console.error('❌ Could not detect your shell. Please specify one:');
          console.log('   bunosh setup-completion --shell bash');
          console.log('   bunosh setup-completion --shell zsh');
          console.log('   bunosh setup-completion --shell fish');
          process.exit(1);
        }

        console.log(`🐚 Detected shell: ${color.bold(shell)}`);
        console.log();

        // Get paths for this shell
        const paths = getCompletionPaths(shell);

        // Check if already installed
        if (!options.force && existsSync(paths.completionFile)) {
          console.log(`⚠️  Completion already installed at: ${paths.completionFile}`);
          console.log('   Use --force to overwrite, or run:');
          console.log(`   ${color.dim('rm')} ${paths.completionFile}`);
          process.exit(0);
        }

        // Install completion
        console.log('🔧 Installing completion...');
        const result = installCompletion(shell);

        // Report success
        console.log(`✅ Completion installed: ${color.green(paths.completionFile)}`);

        if (result.configFile && result.added) {
          console.log(`📝 Updated shell config: ${color.green(result.configFile)}`);
          console.log();
          console.log(`💡 ${color.bold('Restart your terminal')} or run:`);
          if (shell === 'bash') {
            console.log(`   ${color.dim('source ~/.bashrc')}`);
          } else if (shell === 'zsh') {
            console.log(`   ${color.dim('source ~/.zshrc')}`);
          }
        } else if (shell === 'fish') {
          console.log('🐟 Fish completion is ready! No restart needed.');
        } else if (result.configFile && !result.added) {
          console.log(`ℹ️  Shell config already has completion setup: ${result.configFile}`);
          console.log('   Restart your terminal if completion isn\'t working.');
        }

        console.log();
        console.log('🎯 Test completion by typing: ' + color.bold('bunosh <TAB>'));

      } catch (error) {
        console.error(`❌ Setup failed: ${error.message}`);
        process.exit(1);
      }
    });

  internalCommands.push(setupCompletionCmd);

  const upgradeCmd = program.command('upgrade')
    .description('Upgrade bunosh to the latest version')
    .option('-f, --force', 'Force upgrade even if already on latest version')
    .option('--check', 'Check for updates without upgrading')
    .action(async (options) => {
      await upgradeCommand(options);
    });

  internalCommands.push(upgradeCmd);

  // Add personal commands help section if personal commands exist
  const homeTaskNamesForHelp = Object.keys(homeTasks).filter(key => typeof homeTasks[key] === 'function');
  if (homeTaskNamesForHelp.length > 0) {
    const homeCommandsList = homeTaskNamesForHelp.sort().map(taskName => {
      const commandName = `my:${taskName}`;
      const taskComment = homeComments[taskName] || '';
      const description = taskComment ? taskComment.split('\n')[0] : 'Personal command';
      return `  ${color.white.bold(commandName.padEnd(18))} ${color.gray(description)}`;
    }).join('\n');

    program.addHelpText('after', `

My Commands (from ~/${BUNOSHFILE}):
${homeCommandsList}
`);
  }

  // Add npm scripts help section if npm scripts exist
  const npmScriptNamesForHelp = Object.keys(npmScripts);
  if (npmScriptNamesForHelp.length > 0) {
    const npmCommandsList = npmScriptNamesForHelp.sort().map(scriptName => {
      const commandName = `npm:${scriptName}`;
      const scriptCommand = npmScripts[scriptName];
      return `  ${color.white.bold(commandName.padEnd(18))} ${color.gray(scriptCommand)}`;
    }).join('\n');

    program.addHelpText('after', `

NPM Scripts:
${npmCommandsList}
`);
  }

  program.addHelpText('after', color.dim(`
Special Commands:

  ${color.bold('bunosh edit')}           📝 Edit bunosh file with $EDITOR
  ${color.bold('bunosh export:scripts')} 📥 Export commands to package.json
  ${color.bold('bunosh upgrade')}        🦾 Upgrade bunosh
  ${color.bold('bunosh -e "say(\'Hi\')"')} 🔧 Run inline Bunosh script
  ${color.bold('bunosh --bunoshfile …')} 🥧 Load custom Bunoshfile from path

`));

  program.on("command:*", (cmd) => {
    console.log(`\nUnknown command ${cmd}\n`);
    program.outputHelp();
  });

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.outputHelp();
    return program;
  }

  program.parse(process.argv);

  function fetchComments() {
    const comments = {};

    let startFromLine = 0;

    traverse(completeAst, {
      FunctionDeclaration(path) {
        const functionName = path.node.id && path.node.id.name;

        const commentSource = source
          .split("\n")
          .slice(startFromLine, path.node?.loc?.start?.line)
          .join("\n");
        const matches = commentSource.match(
          /\/\*\*\s([\s\S]*)\\*\/\s*export/,
        );

        if (matches && matches[1]) {
          comments[functionName] = matches[1]
            .replace(/^\s*\*\s*/gm, "")
            .replace(/\s*\*\*\s*$/gm, "")
            .trim()
            .replace(/^@.*$/gm, "")
            .trim();
        } else {
          // Check for comments attached to the first statement in the function body
          const firstStatement = path.node?.body?.body?.[0];
          const leadingComments = firstStatement?.leadingComments;

          if (leadingComments && leadingComments.length > 0) {
            comments[functionName] = leadingComments[0].value.trim();
          }
        }

        startFromLine = path.node?.loc?.end?.line;
      },
    });

    return comments;
  }

  function fetchHomeComments() {
    if (!homeSource) return {};

    const homeComments = {};
    let homeCompleteAst;

    try {
      homeCompleteAst = babelParser.parse(homeSource, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (parseError) {
      console.warn('Warning: Could not parse home Bunoshfile for comments:', parseError.message);
      return {};
    }

    let startFromLine = 0;

    traverse(homeCompleteAst, {
      FunctionDeclaration(path) {
        const functionName = path.node.id && path.node.id.name;

        const commentSource = homeSource
          .split("\n")
          .slice(startFromLine, path.node?.loc?.start?.line)
          .join("\n");
        const matches = commentSource.match(
          /\/\*\*\s([\s\S]*)\\*\/\s*export/,
        );

        if (matches && matches[1]) {
          homeComments[functionName] = matches[1]
            .replace(/^\s*\*\s*/gm, "")
            .replace(/\s*\*\*\s*$/gm, "")
            .trim()
            .replace(/^@.*$/gm, "")
            .trim();
        } else {
          // Check for comments attached to the first statement in the function body
          const firstStatement = path.node?.body?.body?.[0];
          const leadingComments = firstStatement?.leadingComments;

          if (leadingComments && leadingComments.length > 0) {
            homeComments[functionName] = leadingComments[0].value.trim();
          }
        }

        startFromLine = path.node?.loc?.end?.line;
      },
    });

    return homeComments;
  }

  function fetchHomeFnAst(fnName, source) {
    try {
      return babelParser.parse(source, {
        sourceType: "module",
        ranges: true,
        tokens: true,
        comments: true,
        attachComment: true,
      });
    } catch (parseError) {
      console.warn('Warning: Could not parse home function AST:', parseError.message);
      return null;
    }
  }

  function parseHomeArgs(fnName, ast) {
    if (!ast) return {};

    const functionArguments = {};

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id.name !== fnName) return;

        const params = path.node.params
          .filter((node) => {
            return node?.right?.type !== "ObjectExpression";
          })
          .forEach((param) => {
            if (param.type === "AssignmentPattern") {
              functionArguments[param.left.name] = param.right.value;
              return;
            }
            if (!param.name) return;

            return functionArguments[param.name] = null;
          });
      },
    });

    return functionArguments;
  }

  function parseHomeOpts(fnName, ast) {
    if (!ast) return {};

    let functionOpts = {};

    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id.name !== fnName) return;

        const node = path.node.params.pop();
        if (!node) return;
        if (
          !node.type === "AssignmentPattern" &&
          node.right.type === "ObjectExpression"
        )
          return;

        node?.right?.properties?.forEach((p) => {
          if (
            ["NumericLiteral", "StringLiteral", "BooleanLiteral"].includes(
              p.value.type,
            )
          ) {
            functionOpts[camelToDasherize(p.key.name)] = p.value.value;
            return;
          }

          if (p.value.type === "NullLiteral") {
            functionOpts[camelToDasherize(p.key.name)] = null;
            return;
          }

          if (p.value.type == "UnaryExpression" && p.value.operator == "!") {
            functionOpts[camelToDasherize(p.key.name)] =
              !p.value.argument.value;
            return;
          }
        });
      },
    });

    return functionOpts;
  }
}

function prepareCommandName(name) {
  name = name
    .split(/(?=[A-Z])/)
    .join("-")
    .toLowerCase();
  return name.replace("-", ":");
}

function camelToDasherize(camelCaseString) {
  return camelCaseString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}


function parseDocBlock(funcName, code) {
  const regex = new RegExp(
    `\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export\\s+function\\s+${funcName}\\s*\\(`,
  );
  const match = code.match(regex);

  if (match && match[1]) {
    return match[1]
      .replace(/^\s*\*\s*/gm, "")
      .split("\n")[0]
      .trim();
  }

  return null;
}

function exportFn(commands) {
  if (!existsSync(BUNOSHFILE)) {
    console.error(`${BUNOSHFILE} file not found, can\'t export its commands.`);
    return false;
  }

  if (!existsSync('package.json')) {
    console.error('package.json now found, can\'t set scripts.');
    return false;
  }

  const pkg = JSON.parse(readFileSync('package.json').toString());
  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  for (let s in pkg.scripts ) {
    if (pkg[s] && pkg[s].startsWith('bunosh')) delete pkg[s];
  }

  const scripts = Object.fromEntries(commands.map(prepareCommandName).map(k => [k, 'bunosh '+k]));

  pkg.scripts = {...pkg.scripts, ...scripts };

  writeFileSync('package.json', JSON.stringify(pkg, null, 4));

  console.log('Added scripts:');
  console.log();

  Object.keys(scripts).forEach(k => console.log('   bun run ' + k));

  console.log();
  console.log('package.json updated');
  console.log(`${Object.keys(scripts).length} scripts exported`);
  return true;
}

function loadNpmScripts() {
  try {
    if (!existsSync('package.json')) {
      return {};
    }

    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const scripts = pkg.scripts || {};

    // Filter out bunosh scripts (scripts that contain "bunosh")
    const npmScripts = {};
    Object.entries(scripts).forEach(([name, command]) => {
      if (!command.includes('bunosh')) {
        npmScripts[name] = command;
      }
    });

    return npmScripts;
  } catch (error) {
    console.warn('Warning: Could not load npm scripts from package.json:', error.message);
    return {};
  }
}

// Load personal commands from user's home directory
async function loadHomeTasks() {
  try {
    const os = await import('os');
    const path = await import('path');
    const homeDir = os.homedir();
    const homeBunoshfile = path.join(homeDir, BUNOSHFILE);

    if (!existsSync(homeBunoshfile)) {
      return { tasks: {}, source: '' };
    }

    // Import the home Bunoshfile
    const homeTasks = await import(homeBunoshfile);
    const homeSource = readFileSync(homeBunoshfile, 'utf-8');

    return { tasks: homeTasks, source: homeSource };
  } catch (error) {
    console.warn('Warning: Could not load personal commands:', error.message);
    return { tasks: {}, source: '' };
  }
}
