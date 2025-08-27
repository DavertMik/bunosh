import { Command } from "commander";
import babelParser from "@babel/parser";
import traverseDefault from "@babel/traverse";
const traverse = traverseDefault.default || traverseDefault;
import color from "chalk";
import fs from 'fs';
import openEditor from 'open-editor';
import { yell } from './io.js';
import cprint from "./font.js";
import { handleCompletion, detectCurrentShell, installCompletion, getCompletionPaths } from './completion.js';
import { upgradeExecutable, isExecutable, getCurrentVersion } from './upgrade.js';

export const BUNOSHFILE = `Bunoshfile.js`;

export const banner = () => {
  console.log(cprint('Bunosh', { symbol: '⯀' }));
  console.log(color.gray('🍲 Your exceptional task runner'));
  console.log();
};

export default function bunosh(commands, source) {
  const program = new Command();
  program.option('--bunoshfile <path>', 'Path to the Bunoshfile');

  const internalCommands = [];

  // Load npm scripts from package.json
  const npmScripts = loadNpmScripts();

  program.configureHelp({
    commandDescription: _cmd => {
      // Show banner and description
      banner();
      return `  Commands are loaded from exported functions in ${color.bold(BUNOSHFILE)}`;
    },
    commandUsage: usg => 'bunosh <command> <args> [options]',
    showGlobalOptions: false,
    visibleGlobalOptions: _opt => [],
    visibleOptions: _opt => [],
    visibleCommands: cmd => cmd.commands.filter(c => !internalCommands.includes(c)),
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

  // Collect all commands (bunosh + npm scripts) and sort them
  const allCommands = [];

  // Add bunosh commands
  Object.keys(commands).forEach((fnName) => {
    allCommands.push({ type: 'bunosh', name: fnName, data: commands[fnName] });
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

      if (comment && argsAndOptsDescription.length) description += `\n  ${color.gray(`bunosh ${commandName}`)} ${color.blue(argsAndOptsDescription.join(' ').trim())}`;

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
    .action(() => {
      openEditor([{
        file: BUNOSHFILE,
      }], {
        editor: process.env.EDITOR ? null : 'code',
      });
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
        if (!options.force && fs.existsSync(paths.completionFile)) {
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
    .description('Upgrade bunosh to the latest version (single executable only)')
    .option('-f, --force', 'Force upgrade even if already on latest version')
    .option('--check', 'Check for updates without upgrading')
    .action(async (options) => {
      try {
        if (!isExecutable()) {
          console.log('📦 Bunosh is installed via npm.');
          console.log('To upgrade, run: ' + color.bold('npm update -g bunosh'));
          process.exit(0);
        }

        const currentVersion = getCurrentVersion();
        console.log(`📍 Current version: ${color.bold(currentVersion)}`);

        if (options.check) {
          console.log('🔍 Checking for updates...');
          try {
            const { getLatestRelease, isNewerVersion } = await import('./upgrade.js');
            const release = await getLatestRelease();
            const latestVersion = release.tag_name;
            
            console.log(`📦 Latest version: ${color.bold(latestVersion)}`);
            
            if (isNewerVersion(latestVersion, currentVersion)) {
              console.log(`✨ ${color.green('Update available!')} ${currentVersion} → ${latestVersion}`);
              console.log('Run ' + color.bold('bunosh upgrade') + ' to update.');
            } else {
              console.log(`✅ ${color.green('You are on the latest version!')}`);
            }
          } catch (error) {
            console.error(`❌ Failed to check for updates: ${error.message}`);
            process.exit(1);
          }
          return;
        }

        console.log('⬆️  Starting upgrade process...');
        console.log();

        let lastMessage = '';
        const result = await upgradeExecutable({
          force: options.force,
          onProgress: (message) => {
            if (message !== lastMessage) {
              console.log(`   ${message}`);
              lastMessage = message;
            }
          }
        });

        console.log();
        if (result.updated) {
          console.log(`🎉 ${color.green('Upgrade successful!')}`);
          console.log(`   ${result.currentVersion} → ${color.bold(result.latestVersion)}`);
          console.log();
          console.log(`💡 Run ${color.bold('bunosh --version')} to verify the new version.`);
        } else {
          console.log(`✅ ${color.green(result.message)}`);
          if (!options.force) {
            console.log(`   Use ${color.bold('--force')} to reinstall the current version.`);
          }
        }

      } catch (error) {
        console.error(`❌ Upgrade failed: ${error.message}`);
        
        if (error.message.includes('Unsupported platform')) {
          console.log();
          console.log('💡 Supported platforms:');
          console.log('   • Linux x64');
          console.log('   • macOS ARM64 (Apple Silicon)');
          console.log('   • Windows x64');
        } else if (error.message.includes('GitHub API')) {
          console.log();
          console.log('💡 Try again later or check your internet connection.');
        }
        
        process.exit(1);
      }
    });

  internalCommands.push(upgradeCmd);

  program.addHelpText('after', `

Special Commands:
  📝 Edit bunosh file: ${color.bold('bunosh edit')}
  📥 Export scripts to package.json: ${color.bold('bunosh export:scripts')}
  🔤 Generate shell completion: ${color.bold('bunosh completion bash|zsh|fish')}
  ⚡ Auto-setup completion: ${color.bold('bunosh setup-completion')}
  ⬆️  Upgrade bunosh: ${color.bold('bunosh upgrade')}
`);

  program.on("command:*", (cmd) => {
    console.log(`\nUnknown command ${cmd}\n`);
    program.outputHelp();
  });

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
  if (!fs.existsSync(BUNOSHFILE)) {
    console.error(`${BUNOSHFILE} file not found, can\'t export its commands.`);
    return false;
  }

  if (!fs.existsSync('package.json')) {
    console.error('package.json now found, can\'t set scripts.');
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync('package.json').toString());
  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  for (let s in pkg.scripts ) {
    if (pkg[s] && pkg[s].startsWith('bunosh')) delete pkg[s];
  }

  const scripts = Object.fromEntries(commands.map(prepareCommandName).map(k => [k, 'bunosh '+k]));

  pkg.scripts = {...pkg.scripts, ...scripts };

  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4));

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
    if (!fs.existsSync('package.json')) {
      return {};
    }

    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
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
