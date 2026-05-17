import { Command } from "commander";
import babelParser from "@babel/parser";
import traverseDefault from "@babel/traverse";
const traverse = traverseDefault.default || traverseDefault;
import color from "chalk";
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { yell } from './io.js';
import { formatError } from './error-formatter.js';
import cprint from "./font.js";
import { handleCompletion, detectCurrentShell, installCompletion, getCompletionPaths } from './completion.js';
import { upgradeCommand, printUpgradeNoticeIfAvailable } from './upgrade.js';

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

  const startColor = { r: 255, g: 220, b: 0 };
  const endColor = { r: 139, g: 69, b: 19 };

  return lines.map((line, index) => {
    if (line.includes('░') || line.includes('▒') || line.includes('▓')) {
      return `\x1b[38;2;139;69;19m${line}\x1b[0m`;
    }

    const progress = index / (lines.length - 1);
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * progress);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * progress);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * progress);

    return `\x1b[38;2;${r};${g};${b}m${line}\x1b[0m`;
  }).join('\n');
}

export default async function bunosh(commands, sources) {
  const program = new Command();
  program.option('--bunoshfile <path>', 'Path to the Bunoshfile');
  program.option('--env-file <path>', 'Path to environment file');

  const internalCommands = [];


  program.configureHelp({
    commandDescription: _cmd => {
      banner();
      return ' ';
    },
    commandUsage: usg => 'bunosh <command> <args> [options]',
    showGlobalOptions: false,
    visibleGlobalOptions: _opt => [],
    visibleOptions: _opt => [],
    visibleCommands: cmd => {
      return [];
    },
    subcommandTerm: (cmd) => color.white.bold(cmd.name()),
    subcommandDescription: (cmd) => color.gray(cmd.description()),
  });

  // program.showHelpAfterError();
  program.showSuggestionAfterError(true);
  program.addHelpCommand(false);

  program.configureOutput({
    writeErr: (str) => {
      process.stderr.write(str.replace(/^error:/g, color.red('Error') + ':'));
    },
    writeOut: (str) => process.stdout.write(str)
  });

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

        if (!namespaceSources[cmdInfo.namespace || '']) {
          namespaceSources[cmdInfo.namespace || ''] = {
            ast: ast,
            source: cmdInfo.source
          };
        }

        const fnName = cmdInfo.namespace ? cmdName.split(':')[1] : cmdName;
        if (fnName) {
          comments[cmdName] = extractCommentForFunction(ast, cmdInfo.source, fnName);
        }
      } catch (parseError) {
        parseError.code = 'BABEL_PARSER_SYNTAX_ERROR';
        throw parseError;
      }
    }
  }

  const allCommands = [];

  Object.keys(commands).forEach((cmdName) => {
    const sourceInfo = sources[cmdName];
    if (sourceInfo && sourceInfo.namespace) {
      allCommands.push({
        type: 'namespace',
        name: cmdName,
        namespace: sourceInfo.namespace,
        data: commands[cmdName]
      });
    } else {
      allCommands.push({ type: 'bunosh', name: cmdName, data: commands[cmdName] });
    }
  });



  allCommands.sort((a, b) => a.name.localeCompare(b.name));

  const commandsByNamespace = {
    '': [],
    'dev': [],
  };

  allCommands.forEach(cmd => {
    if (cmd.type === 'namespace' && cmd.namespace) {
      const namespace = cmd.namespace || 'dev';
      if (!commandsByNamespace[namespace]) {
        commandsByNamespace[namespace] = [];
      }
      commandsByNamespace[namespace].push(cmd);
    } else {
      commandsByNamespace[''].push(cmd);
    }
  });

  allCommands.forEach((cmdData) => {
    const isNamespaced = cmdData.type === 'namespace' && cmdData.namespace;
    const fnName = isNamespaced
      ? (sources[cmdData.name].originalFnName || cmdData.name.split(':')[1])
      : cmdData.name;
    const namespace = isNamespaced ? cmdData.namespace : '';
    const fnBody = commands[isNamespaced ? cmdData.name : fnName].toString();
    const namespaceSource = namespaceSources[namespace];

    const ast = namespaceSource?.ast || babelParser.parse(fnBody, { comment: true, tokens: true });
    const args = parseArgs(ast, fnName);
    const opts = parseOpts(ast, fnName);
    const comment = comments[isNamespaced ? cmdData.name : fnName];

    let commandName;
    if (isNamespaced && cmdData.name.includes(':')) {
      commandName = cmdData.name.split(':')[0] + ':' + toKebabCase(cmdData.name.split(':')[1]).replace(/^[^:]+:/, '');
    } else {
      commandName = prepareCommandName(isNamespaced ? cmdData.name : fnName);
    }

    const command = program.command(commandName);
    if (comment) {
      command.description(comment);
    }
    command.hook('preAction', (_thisCommand) => {
      process.env.BUNOSH_COMMAND_STARTED = true;

      const isBun = typeof Bun !== 'undefined';
      const runtime = isBun ? 'Bun' : 'Node.js';
      const runtimeColor = isBun ? color.red : color.green;

      let runtimeVersion;
      if (isBun) {
        runtimeVersion = Bun.version;
      } else {
        runtimeVersion = process.version;
      }

      console.log(color.gray(`Runtime: `, runtimeColor.bold(runtime), color.gray(` (${runtimeVersion})`)));
      console.log();
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
      const separator = isNamespaced ? '\n  ' : '\n ▹ ';
      description += `${separator}${color.gray(`bunosh ${commandName}`)} ${color.blue(argsAndOptsDescription.join(' ').trim())}`;
    }

    command.description(description);

    command.configureHelp({
      commandDescription: () => comment || '',
      commandUsage: cmd => `bunosh ${cmd.name()}${argsAndOptsDescription.length ? ' ' + argsAndOptsDescription.join(' ').trim() : ''}`,
      showGlobalOptions: false,
      visibleGlobalOptions: () => [],
      visibleOptions: () => [],
      visibleCommands: () => []
    });
    command.showHelpAfterError();

    command.action(createCommandAction(commands[isNamespaced ? cmdData.name : fnName], args, opts));
  });

  function createCommandAction(commandFn, args, opts) {
    return async (...commanderArgs) => {
      const transformedArgs = [];
      let argIndex = 0;

      Object.keys(args).forEach((argName) => {
        if (argIndex < commanderArgs.length - 1) {
          transformedArgs.push(commanderArgs[argIndex++]);
        } else {
          transformedArgs.push(args[argName]);
        }
      });

      const optNames = Object.keys(opts);
      if (optNames.length > 0) {
        const lastArg = commanderArgs[commanderArgs.length - 1];
        const optionsObj = (lastArg && typeof lastArg.opts === 'function') ? lastArg.opts() : lastArg;
        const mergedOpts = {};
        optNames.forEach((optName) => {
          const camelName = optName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          if (optionsObj && optionsObj[camelName] !== undefined) {
            mergedOpts[camelName] = optionsObj[camelName];
          } else if (optionsObj && optionsObj[optName] !== undefined) {
            mergedOpts[camelName] = optionsObj[optName];
          } else {
            mergedOpts[camelName] = opts[optName];
          }
        });
        transformedArgs.push(mergedOpts);
      }

      try {
        return await commandFn(...transformedArgs);
      } catch (error) {
        console.error('\n' + formatError(error));
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

        const paths = getCompletionPaths(shell);

        if (!options.force && existsSync(paths.completionFile)) {
          console.log(`⚠️  Completion already installed at: ${paths.completionFile}`);
          console.log('   Use --force to overwrite, or run:');
          console.log(`   ${color.dim('rm')} ${paths.completionFile}`);
          process.exit(0);
        }

        console.log('🔧 Installing completion...');
        const result = installCompletion(shell);

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

  const SKILLS_REPO = 'DavertMik/bunosh-skills';

  const installSkillsCmd = program.command('install-skills')
    .description('Print the command to install Bunosh AI agent skills.')
    .action(() => {
      console.log();
      console.log(`🤖 Install Bunosh AI agent skills (Claude Code, Cursor, Codex, ...):`);
      console.log();
      console.log(`   ${color.bold(`npx skills add ${SKILLS_REPO}`)}`);
      console.log();
      console.log(color.dim(`   Skills: bunosh-fundamentals, migrate-to-bunosh`));
      console.log(color.dim(`   ${SKILLS_REPO} · https://buno.sh`));
      console.log();
    });

  internalCommands.push(installSkillsCmd);

  const upgradeCmd = program.command('upgrade')
    .description('Upgrade bunosh to the latest version')
    .option('-f, --force', 'Force upgrade even if already on latest version')
    .option('--check', 'Check for updates without upgrading')
    .action(async (options) => {
      await upgradeCommand(options);
    });

  internalCommands.push(upgradeCmd);


  let helpText = '';

  if (commandsByNamespace[''].length > 0) {
    const mainCommands = commandsByNamespace[''].map(cmd => {
      const processedName = cmd.type === 'bunosh' ? toKebabCase(cmd.name) : cmd.name;
      const cmdObj = program.commands.find(c => c.name() === processedName);
      const description = cmdObj ? cmdObj.description() : '';
      const paddedName = processedName.padEnd(22);

      if (!description) {
        return `  ${color.white.bold(paddedName)}`;
      }

      const lines = description.split('\n');
      const firstLine = `  ${color.white.bold(paddedName)} ${color.dim(lines[0])}`;
      const indentedLines = lines.slice(1).map(line =>
        line.trim() ? `                          ${line}` : ''
      ).filter(line => line);

      return [firstLine, ...indentedLines].join('\n');
    }).join('\n');
    helpText += `Commands:
${mainCommands}

`;
  }

  if (commandsByNamespace.dev.length > 0) {
    const devCommands = commandsByNamespace.dev.map(cmd => {
      let processedName;
      if (cmd.type === 'namespace') {
        if (cmd.name.includes(':')) {
          const [namespace, functionName] = cmd.name.split(':');
          processedName = `${namespace}:${toKebabCase(functionName).replace(/^[^:]+:/, '')}`;
        } else {
          processedName = toKebabCase(cmd.name);
        }
      } else {
        processedName = cmd.name;
      }
      const cmdObj = program.commands.find(c => c.name() === processedName);
      const description = cmdObj ? cmdObj.description() : '';
      const paddedName = processedName.padEnd(22);

      if (!description) {
        return `  ${color.white.bold(paddedName)}`;
      }

      const lines = description.split('\n');
      const firstLine = `  ${color.white.bold(paddedName)} ${color.dim(lines[0])}`;
      const indentedLines = lines.slice(1).map(line =>
        line.trim() ? `                          ${line}` : ''
      ).filter(line => line);

      return [firstLine, ...indentedLines].join('\n');
    }).join('\n');
    helpText += `Dev Commands:
${devCommands}

`;
  }

  Object.keys(commandsByNamespace).forEach(namespace => {
    if (namespace && namespace !== 'dev' && commandsByNamespace[namespace].length > 0) {
      const namespaceName = namespace.charAt(0).toUpperCase() + namespace.slice(1) + ' Commands';
      const namespaceCommands = commandsByNamespace[namespace].map(cmd => {
        const cmdObj = program.commands.find(c => c.name() === cmd.name);
        const description = cmdObj ? cmdObj.description() : '';
        const paddedName = cmd.name.padEnd(22);

        if (!description) {
          return `  ${color.white.bold(paddedName)}`;
        }

        const lines = description.split('\n');
        const firstLine = `  ${color.white.bold(paddedName)} ${color.dim(lines[0])}`;
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

  const helpFlagRequested = process.argv.includes('--help') || process.argv.includes('-h');

  if (helpFlagRequested) {
    helpText += color.dim(`Special Commands:
  ${color.bold('bunosh edit')}           📝 Edit bunosh file with $EDITOR
  ${color.bold('bunosh export:scripts')} 📥 Export commands to package.json
  ${color.bold('bunosh upgrade')}        🦾 Upgrade bunosh
  ${color.bold('bunosh -e "say(\'Hi\')"')} 🔧 Run inline Bunosh script
  ${color.bold('bunosh --bunoshfile …')} 🥧 Load custom Bunoshfile from path
  ${color.bold('bunosh --env-file …')}   🔧 Load custom environment file
`);

    helpText += `
${color.bold('🤖 AI agent skills')} ${color.dim('(Claude Code, Cursor, Codex, ...)')}
  ${color.bold('npx skills add DavertMik/bunosh-skills')}
  ${color.dim('bunosh-fundamentals · migrate-to-bunosh — see "bunosh install-skills"')}
`;
  }

  program.addHelpText('after', helpText);

  program.on("command:*", (cmd) => {
    console.error(`\nUnknown command ${cmd}\n`);
    program.outputHelp();
    process.exit(1);
  });


  if (process.argv.length === 2) {
    program.outputHelp();
    await printUpgradeNoticeIfAvailable();
    return program;
  }

  program.parse(process.argv);
}

function prepareCommandName(name) {
  const lastColonIndex = name.lastIndexOf(':');
  if (lastColonIndex !== -1) {
    const namespace = name.substring(0, lastColonIndex);
    const commandPart = name.substring(lastColonIndex + 1);
    return `${namespace}:${toKebabCase(commandPart)}`;
  }

  return toKebabCase(name);
}

function toKebabCase(name) {
  const parts = name.split(/(?=[A-Z])/);

  if (parts.length > 1) {
    const namespace = parts[0].toLowerCase();
    const command = parts.slice(1).join("-").toLowerCase();
    return `${namespace}:${command}`;
  }

  return name.toLowerCase();
}

function camelToDasherize(camelCaseString) {
  return camelCaseString.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
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


function extractCommentForFunction(ast, source, fnName) {
  let comment = '';

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name !== fnName) return;

      const functionStartLine = path.node.loc.start.line;

      if (ast.comments) {
        for (const astComment of ast.comments) {
          if (astComment.type === 'CommentBlock' && astComment.value.startsWith('*')) {
            const commentEndLine = astComment.loc.end.line;

            if (commentEndLine === functionStartLine - 1) {
              comment = astComment.value
                .replace(/^\s*\*\s*/gm, '')
                .replace(/^\s*@.*$/gm, '')
                .replace(/\n\s*\n/g, '\n')
                .replace(/^\*\s*/, '')
                .trim();
              break;
            }
          }
        }
      }

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
      if (path.node.id?.name !== fnName) return;

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

          return functionArguments[param.name] = undefined;
        });

    },
  });

  return functionArguments;
}

function parseOpts(ast, fnName) {
  let functionOpts = {};

  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name !== fnName) return;

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

export class BunoshCommand {
  constructor(name, namespace, args, opts, comment, fn) {
    this.name = name;
    this.namespace = namespace || '';
    this.args = args;
    this.opts = opts;
    this.comment = comment;
    this.function = fn;
  }

  get fullName() {
    return this.namespace ? `${this.namespace}:${this.name}` : this.name;
  }

  get cliName() {
    if (this.namespace) {
      return `${this.namespace}:${camelToDasherize(this.name)}`;
    }
    return camelToDasherize(this.name);
  }

  get allParams() {
    return [...Object.keys(this.args), ...Object.keys(this.opts)];
  }

  get requiredParams() {
    return Object.keys(this.args).filter(arg => this.args[arg] === undefined);
  }
}

export function processCommands(commands, sources) {
  const parsedCommands = [];

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

        if (!namespaceSources[cmdInfo.namespace || '']) {
          namespaceSources[cmdInfo.namespace || ''] = {
            ast: ast,
            source: cmdInfo.source
          };
        }

        const fnName = cmdInfo.namespace ? cmdName.split(':')[1] : cmdName;
        if (fnName) {
          comments[cmdName] = extractCommentForFunction(ast, cmdInfo.source, fnName);
        }
      } catch (parseError) {
        parseError.code = 'BABEL_PARSER_SYNTAX_ERROR';
        throw parseError;
      }
    }
  }

  Object.entries(commands).forEach(([cmdName, cmdFn]) => {
    const sourceInfo = sources[cmdName];
    const originalFnName = sourceInfo?.originalFnName || cmdName.split(':')[1] || cmdName;
    const namespace = sourceInfo?.namespace || '';
    const namespaceSource = namespaceSources[namespace];
    const comment = comments[cmdName];

    const fnBody = cmdFn.toString();
    const ast = namespaceSource?.ast || babelParser.parse(fnBody, { comment: true, tokens: true });
    const args = parseArgs(ast, originalFnName);
    const opts = parseOpts(ast, originalFnName);

    const commandName = originalFnName;

    parsedCommands.push(new BunoshCommand(
      commandName,
      namespace,
      args,
      opts,
      comment,
      cmdFn
    ));
  });

  return parsedCommands;
}

export { parseArgs, parseOpts, extractCommentForFunction };
