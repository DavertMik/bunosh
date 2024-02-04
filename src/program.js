const { Command } = require("commander");
import babelParser from "@babel/parser";
import traverse from "@babel/traverse";
import color from "picocolors";
import cfonts from 'cfonts';

const BUNOSHFILE = `bunoshFile.js`;

const banner = `
${cfonts.render('Bunosh', { font: 'pallet', gradient: ['blue','yellow'], colors: ['system'], space: false}).string}

🍲 ${color.bold(color.white('Bunosh'))} - your ${color.bold('exceptional')} task runner powered by Bun
   Commands are loaded from ${color.bold(BUNOSHFILE)} as JS functions`;

export default function bunosh(commands, source) {
  const program = new Command();

  program.configureHelp({
    commandDescription: _cmd => banner,
    commandUsage: usg => 'bunosh <command> <args> [options]',
    showGlobalOptions: false,
    visibleArguments: _opt => [],
    visibleGlobalOptions: _opt => [],
    // Bunosh has no default options
    // visibleOptions: _opt => [],
    // commandDescription: _opt => '',
    // argumentTerm: (arg) => color.gray("aaa"),
    subcommandTerm: (cmd) => pickColorForColorName(cmd.name()),
  });  

  const completeAst = babelParser.parse(source, {
    sourceType: "module",
    plugins: ["jsx"],
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

    const command = program.command(prepareCommandName(fnName));

    
    args.filter(a => !!a).forEach((arg) => {
      command.argument(`<${arg}>`);
    });
    Object.entries(opts).forEach(([opt, value]) => {
      if (value === false || value === null) command.option(`--${opt}`);
      command.option(`--${opt} [${opt}]`, "", value);
    });

    command.description(comment);
    command.action(commands[fnName].bind(commands));

    // We either take the ast from the file or we parse the function body
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

    // We parse command args from function args
    function parseArgs() {
      const functionArguments = [];

      traverse(ast, {
        FunctionDeclaration(path) {
          if (path.node.id.name !== fnName) return;

          const params = path.node.params
            .filter((node) => {
              return node?.right?.type !== "ObjectExpression";
            })
            .map((param) => param.name);

          functionArguments.push(params);
        },
      });

      return functionArguments.flat();
    }


    // We parse command options from the object of last function args
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

          node.right.properties.forEach((p) => {
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
            // ignore other options for now
          });
        },
      });

      return functionOpts;
    }
  });

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
            .replace(/^\s*\*\s*/gm, "") // remove * chars
            .trim()
            .replace(/^@.*$/gm, "") // remove params from description
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
    // Remove leading asterisks and trim the result
    return match[1]
      .replace(/^\s*\*\s*/gm, "")
      .split("\n")[0]
      .trim();
  }

  return null;
}
