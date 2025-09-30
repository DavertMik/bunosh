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

export default async function bunosh(commands, sources) {
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
    commandUsage: usg => 'bunosh [-e <code>] <command> <args> [options]',
    showGlobalOptions: false,
    visibleGlobalOptions: _opt => [],
    visibleOptions: _opt => [],
    visibleCommands: cmd => {
      // Hide all commands from default listing - we'll show them in custom sections
      return [];
    },
    subcommandTerm: (cmd) => color.white.bold(cmd.name()),
    subcommandDescription: (cmd) => color.gray(cmd.description()),
  });

  program.showHelpAfterError();
  program.showSuggestionAfterError(true);
  program.addHelpCommand(false);

  // Parse AST and comments for each source
  const comments = {};
  const namespaceSources = {};
  
  for (const [cmdName, cmdInfo] of Object.entries(sources)) {
    if (cmdInfo.source) {
      try {
        const ast = babelParser.parse(cmdInfo.source, {
          sourceType: "module",
          ranges: true,
          tokens: true,
          comments: true,
          attachComment: true,
        });
        
        // Store AST for this command
        if (!namespaceSources[cmdInfo.namespace || '']) {
          namespaceSources[cmdInfo.namespace || ''] = {
            ast: ast,
            source: cmdInfo.source
          };
        }
        
        // Extract comments for this command
        const fnName = cmdInfo.namespace ? cmdName.split(':')[1] : cmdName;
        if (fnName) {
          comments[cmdName] = extractCommentForFunction(ast, cmdInfo.source, fnName);
        }
      } catch (parseError) {
        // Re-throw with more specific error information
        parseError.code = 'BABEL_PARSER_SYNTAX_ERROR';
        throw parseError;
      }
    }
  }
  
  // Collect all commands (bunosh + namespace commands + npm scripts) and sort them
  const allCommands = [];

  // Add bunosh commands (including namespaced ones)
  Object.keys(commands).forEach((cmdName) => {
    const sourceInfo = sources[cmdName];
    if (sourceInfo && sourceInfo.namespace) {
      // This is a namespaced command
      allCommands.push({ 
        type: 'namespace', 
        name: cmdName, 
        namespace: sourceInfo.namespace,
        data: commands[cmdName] 
      });
    } else {
      // Regular bunosh command
      allCommands.push({ type: 'bunosh', name: cmdName, data: commands[cmdName] });
    }
  });

  
  // Add npm scripts
  Object.entries(npmScripts).forEach(([scriptName, scriptCommand]) => {
    allCommands.push({ type: 'npm', name: `npm:${scriptName}`, data: { scriptName, scriptCommand } });
  });

  // Sort all commands alphabetically by name
  allCommands.sort((a, b) => a.name.localeCompare(b.name));

  // Organize commands by namespace for help display
  const commandsByNamespace = {
    '': [], // Main commands (no namespace)
    'dev': [], // Dev commands
    'npm': [], // NPM scripts
  };

  // Categorize commands by namespace
  allCommands.forEach(cmd => {
    if (cmd.type === 'npm') {
      commandsByNamespace.npm.push(cmd);
    } else if (cmd.type === 'namespace' && cmd.namespace) {
      // Group by namespace, defaulting to 'dev' for unknown namespaces
      const namespace = cmd.namespace || 'dev';
      if (!commandsByNamespace[namespace]) {
        commandsByNamespace[namespace] = [];
      }
      commandsByNamespace[namespace].push(cmd);
    } else {
      commandsByNamespace[''].push(cmd);
    }
  });

  // Process all commands in sorted order
  allCommands.forEach((cmdData) => {
    if (cmdData.type === 'bunosh' || (cmdData.type === 'namespace' && !cmdData.namespace)) {
      // Handle main bunosh commands (no namespace)
      const fnName = cmdData.name;
      const fnBody = commands[fnName].toString();
      const sourceInfo = sources[fnName];
      const namespaceSource = namespaceSources[''];

      const ast = namespaceSource?.ast || babelParser.parse(fnBody, { comment: true, tokens: true });
      const args = parseArgs(ast, fnName);
      const opts = parseOpts(ast, fnName);
      const comment = comments[fnName];

      const commandName = prepareCommandName(fnName);

      const command = program.command(commandName);
      if (comment) {
        command.description(comment);
      }
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
      command.action(createCommandAction(commands[fnName], args, opts));
    } else if (cmdData.type === 'namespace') {
      // Handle namespaced commands
      const sourceInfo = sources[cmdData.name];
      const originalFnName = sourceInfo.originalFnName || cmdData.name.split(':')[1]; // Get original function name
      const namespace = cmdData.namespace;
      const fnBody = commands[cmdData.name].toString();
      const namespaceSource = namespaceSources[namespace];

      const ast = namespaceSource?.ast || babelParser.parse(fnBody, { comment: true, tokens: true });
      const args = parseArgs(ast, originalFnName);
      const opts = parseOpts(ast, originalFnName);
      const comment = comments[cmdData.name];

      // For namespaced commands, only transform the function part to kebab-case
      const commandName = cmdData.name.includes(':')
        ? cmdData.name.split(':')[0] + ':' + toKebabCase(cmdData.name.split(':')[1]).replace(/^[^:]+:/, '')
        : prepareCommandName(cmdData.name);

      const command = program.command(commandName);
      if (comment) {
        command.description(comment);
      }
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

      if (comment && argsAndOptsDescription.length) {
        description += `\n  ${color.gray(`bunosh ${commandName}`)} ${color.blue(argsAndOptsDescription.join(' ').trim())}`;
      }

      command.description(description);
      command.action(createCommandAction(commands[cmdData.name], args, opts));
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

  // Helper function to create command action with proper argument transformation
  function createCommandAction(commandFn, args, opts) {
    return async (...commanderArgs) => {
      // Transform Commander.js arguments to match function signature
      const transformedArgs = [];
      let argIndex = 0;
      
      // Add positional arguments
      Object.keys(args).forEach((argName) => {
        if (argIndex < commanderArgs.length - 1) { // -1 because last arg is options object
          transformedArgs.push(commanderArgs[argIndex++]);
        } else {
          // Use default value if not provided
          transformedArgs.push(args[argName]);
        }
      });
      
      // Handle options object
      const optionsObj = commanderArgs[commanderArgs.length - 1];
      if (optionsObj && typeof optionsObj === 'object') {
        Object.keys(opts).forEach((optName) => {
          const dasherizedOpt = optName.replace(/([A-Z])/g, '-$1').toLowerCase();
          if (optionsObj[dasherizedOpt] !== undefined) {
            transformedArgs.push(optionsObj[dasherizedOpt]);
          } else {
            // Use default value
            transformedArgs.push(opts[optName]);
          }
        });
      }
      
      // Call the original function with transformed arguments
      return commandFn(...transformedArgs);
    };
  }

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

  
  // Add organized command help sections
  let helpText = '';

  // Main Commands (no namespace)
  if (commandsByNamespace[''].length > 0) {
    const mainCommands = commandsByNamespace[''].map(cmd => {
      const processedName = cmd.type === 'bunosh' ? toKebabCase(cmd.name) : cmd.name;
      const cmdObj = program.commands.find(c => c.name() === processedName);
      const description = cmdObj ? cmdObj.description() : '';
      const paddedName = processedName.padEnd(22);

      if (!description) {
        return `  ${color.white.bold(paddedName)}`;
      }

      // Handle multi-line descriptions with proper indentation
      const lines = description.split('\n');
      const firstLine = `  ${color.white.bold(paddedName)} ${lines[0]}`;
      const indentedLines = lines.slice(1).map(line =>
        line.trim() ? `                          ${line}` : ''
      ).filter(line => line);

      return [firstLine, ...indentedLines].join('\n');
    }).join('\n');
    helpText += `Commands:
${mainCommands}

`;
  }

  // Dev Commands (dev namespace)
  if (commandsByNamespace.dev.length > 0) {
    const devCommands = commandsByNamespace.dev.map(cmd => {
      let processedName;
      if (cmd.type === 'namespace') {
        // For namespaced commands, handle the name properly
        if (cmd.name.includes(':')) {
          // If cmd.name already has namespace (like 'dev:devFn'), only process the part after the colon
          const [namespace, functionName] = cmd.name.split(':');
          processedName = `${namespace}:${toKebabCase(functionName).replace(/^[^:]+:/, '')}`;
        } else {
          // If cmd.name doesn't have namespace, use toKebabCase which will add it
          processedName = toKebabCase(cmd.name);
        }
      } else {
        processedName = cmd.name;
      }
      // Debug removed
      const cmdObj = program.commands.find(c => c.name() === processedName);
      const description = cmdObj ? cmdObj.description() : '';
      const paddedName = processedName.padEnd(22);

      if (!description) {
        return `  ${color.white.bold(paddedName)}`;
      }

      // Handle multi-line descriptions with proper indentation
      const lines = description.split('\n');
      const firstLine = `  ${color.white.bold(paddedName)} ${lines[0]}`;
      const indentedLines = lines.slice(1).map(line =>
        line.trim() ? `                          ${line}` : ''
      ).filter(line => line);

      return [firstLine, ...indentedLines].join('\n');
    }).join('\n');
    helpText += `Dev Commands:
${devCommands}

`;
  }

  // Add other namespace sections dynamically
  Object.keys(commandsByNamespace).forEach(namespace => {
    if (namespace && namespace !== 'dev' && namespace !== 'npm' && commandsByNamespace[namespace].length > 0) {
      const namespaceName = namespace.charAt(0).toUpperCase() + namespace.slice(1) + ' Commands';
      const namespaceCommands = commandsByNamespace[namespace].map(cmd => {
        const cmdObj = program.commands.find(c => c.name() === cmd.name);
        const description = cmdObj ? cmdObj.description() : '';
        const paddedName = cmd.name.padEnd(22);

        if (!description) {
          return `  ${color.white.bold(paddedName)}`;
        }

        // Handle multi-line descriptions with proper indentation
        const lines = description.split('\n');
        const firstLine = `  ${color.white.bold(paddedName)} ${lines[0]}`;
        const indentedLines = lines.slice(1).map(line =>
          line.trim() ? `                          ${line}` : ''
        ).filter(line => line);

        return [firstLine, ...indentedLines].join('\n');
      }).join('\n');
      helpText += `${namespaceName}:
${namespaceCommands}

`;
    }
  });

  // NPM Scripts
  if (commandsByNamespace.npm.length > 0) {
    const npmCommands = commandsByNamespace.npm.map(cmd => {
      const paddedName = cmd.name.padEnd(22);
      return `  ${color.white.bold(paddedName)} ${color.gray(cmd.data.scriptCommand)}`;
    }).join('\n');
    helpText += `NPM Scripts:
${npmCommands}

`;
  }

  // Special Commands
  helpText += color.dim(`Special Commands:
  ${color.bold('bunosh edit')}           📝 Edit bunosh file with $EDITOR
  ${color.bold('bunosh export:scripts')} 📥 Export commands to package.json
  ${color.bold('bunosh upgrade')}        🦾 Upgrade bunosh
  ${color.bold('bunosh -e "say(\'Hi\')"')} 🔧 Run inline Bunosh script
  ${color.bold('bunosh --bunoshfile …')} 🥧 Load custom Bunoshfile from path
`);

  program.addHelpText('after', helpText);

  program.on("command:*", (cmd) => {
    console.error(`\nUnknown command ${cmd}\n`);
    program.outputHelp();
    process.exit(1);
  });

  // Show help if no command provided
  if (process.argv.length === 2) {
    program.outputHelp();
    return program;
  }

  program.parse(process.argv);
}

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

function prepareCommandName(name) {
  // name is already the final command name (could be namespaced or not)
  // For namespaced commands, only transform the function part (after the last colon)
  const lastColonIndex = name.lastIndexOf(':');
  if (lastColonIndex !== -1) {
    const namespace = name.substring(0, lastColonIndex);
    const commandPart = name.substring(lastColonIndex + 1);
    return `${namespace}:${toKebabCase(commandPart)}`;
  }
  
  // For non-namespaced commands, just convert to kebab-case
  return toKebabCase(name);
}

function toKebabCase(name) {
  const parts = name.split(/(?=[A-Z])/);

  // If there are multiple parts, treat first part as namespace with colon
  if (parts.length > 1) {
    const namespace = parts[0].toLowerCase();
    const command = parts.slice(1).join("-").toLowerCase();
    return `${namespace}:${command}`;
  }

  // Single word, just return lowercase
  return name.toLowerCase();
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

function extractCommentForFunction(ast, source, fnName) {
  let comment = '';

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name !== fnName) return;

      const functionStartLine = path.node.loc.start.line;

      // Find the JSDoc comment that immediately precedes this function
      if (ast.comments) {
        for (const astComment of ast.comments) {
          if (astComment.type === 'CommentBlock' && astComment.value.startsWith('*')) {
            const commentEndLine = astComment.loc.end.line;

            // Check if this comment is immediately before the function
            if (commentEndLine === functionStartLine - 1) {
              comment = astComment.value
                .replace(/^\s*\*\s*/gm, '') // Remove leading * and spaces
                .replace(/^\s*@.*$/gm, '') // Remove @param and other @ tags
                .replace(/\n\s*\n/g, '\n') // Remove excessive empty lines
                .replace(/^\*\s*/, '') // Remove any remaining leading *
                .trim();
              break;
            }
          }
        }
      }

      // If no JSDoc comment found, check for comments attached to the first statement in the function body
      if (!comment) {
        const firstStatement = path.node?.body?.body?.[0];
        const statementLeadingComments = firstStatement?.leadingComments;

        if (statementLeadingComments && statementLeadingComments.length > 0) {
          comment = statementLeadingComments[0].value.trim();
        }
      }
    },
  });

  return comment;
}

function parseArgs(ast, fnName) {
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

function parseOpts(ast, fnName) {
  let functionOpts = {};

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id.name !== fnName) return;

      const node = path.node.params.pop();
      if (!node) return;
      if (
        node.type !== "AssignmentPattern" ||
        node.right.type !== "ObjectExpression"
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
