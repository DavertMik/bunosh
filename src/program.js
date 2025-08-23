const { Command } = require("commander");
import babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import color from "chalk";
import fs from 'fs';
import openEditor from 'open-editor';
import banner from '../templates/banner';

export const BUNOSHFILE = `Bunoshfile.js`;

export { banner };

export default function bunosh(commands, source) {
  const program = new Command();
  program.option('--bunoshfile <path>', 'Path to the Bunoshfile');

  const internalCommands = [];

  program.configureHelp({
    commandDescription: _cmd => `${banner}\n  Commands are loaded from exported functions in ${color.bold(BUNOSHFILE)}`,
    commandUsage: usg => 'bunosh <command> <args> [options]',
    showGlobalOptions: false,
    visibleGlobalOptions: _opt => [],
    visibleOptions: _opt => [],
    visibleCommands: cmd => cmd.commands.filter(c => !internalCommands.includes(c)),
    subcommandTerm: (cmd) => pickColorForColorName(cmd.name()),
    subcommandDescription: (cmd) => cmd.description(),
  });

  program.showHelpAfterError();
  program.showSuggestionAfterError(true);
  program.addHelpCommand(false);

  const completeAst = babelParser.parse(source, {
    sourceType: "module",
    ranges: true,
    tokens: true,
    comments: true,
    attachComment: true,
  });

  const comments = fetchComments();

  Object.keys(commands).forEach((fnName) => {
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
  });

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

  program.addHelpText('after', `

Special Commands:
  📝 Edit bunosh file: ${color.bold('bunosh edit')}
  📥 Export scripts to package.json: ${color.bold('bunosh export:scripts')}
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
          const innerComments = path.node?.body?.innerComments;

          if (innerComments && innerComments.length > 0) {
            comments[functionName] = innerComments[0].value.trim();
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

function pickColorForColorName(commandName) {
  const colors = [
    color.red,
    color.green,
    color.yellow,
    color.blue,
    color.magenta,
    color.cyan,
  ];

  const prefixName = camelToDasherize(commandName).split("-")[0];

  const index =
    prefixName.split("").reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0) % colors.length;

  return color.bold(colors[index](commandName));
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