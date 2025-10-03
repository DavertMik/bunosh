import fs from 'fs';
import path from 'path';
import { BUNOSHFILE } from './program.js';

/**
 * Generates shell completion scripts for bunosh commands
 */
export class CompletionGenerator {
  constructor(commands = []) {
    this.commands = commands;
  }

  /**
   * Generates bash completion script
   */
  generateBashCompletion() {
    const commandList = this.commands.map(cmd => cmd.name).join(' ');
    
    return `#!/bin/bash

# Bash completion for bunosh
_bunosh_completion() {
    local cur prev opts
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"

    # Available commands
    opts="${commandList} --help --version init completion"

    # Special handling for specific commands
    case "\${prev}" in
        bunosh)
            COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
        completion)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
            return 0
            ;;
        init)
            # No completion for init
            return 0
            ;;
        *)
            # Default completion for other commands
            COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
            return 0
            ;;
    esac
}

# Register the completion function
complete -F _bunosh_completion bunosh
`;
  }

  /**
   * Generates zsh completion script
   */
  generateZshCompletion() {
    const commandCompletions = this.commands.map(cmd => {
      const args = cmd.args ? cmd.args.map(arg => `'${arg}'`).join(' ') : '';
      const desc = cmd.description ? cmd.description.replace(/'/g, "\\'") : '';
      return `    '${cmd.name}[${desc}]${args ? ':' + args : ''}'`;
    }).join('\n');

    return `#compdef bunosh

# Zsh completion for bunosh
_bunosh() {
    local context state line
    typeset -A opt_args

    _arguments -C \\
        '1: :_bunosh_commands' \\
        '*::arg:->args'

    case $state in
        args)
            case $line[1] in
                completion)
                    _arguments \\
                        '1: :(bash zsh fish)'
                    ;;
                init)
                    # No arguments for init
                    ;;
                *)
                    # Default argument completion
                    _files
                    ;;
            esac
            ;;
    esac
}

_bunosh_commands() {
    local commands
    commands=(
${commandCompletions}
        'completion[Generate shell completion scripts]'
        'init[Create a new Bunoshfile.js]'
        '--help[Show help information]'
        '--version[Show version information]'
    )
    _describe 'commands' commands
}

_bunosh
`;
  }

  /**
   * Generates fish completion script
   */
  generateFishCompletion() {
    const commandCompletions = this.commands.map(cmd => {
      const desc = cmd.description ? cmd.description : '';
      return `complete -c bunosh -f -a "${cmd.name}" -d "${desc}"`;
    }).join('\n');

    return `# Fish completion for bunosh

# Basic commands
${commandCompletions}
complete -c bunosh -f -a "completion" -d "Generate shell completion scripts"
complete -c bunosh -f -a "init" -d "Create a new Bunoshfile.js"
complete -c bunosh -f -l help -d "Show help information"
complete -c bunosh -f -l version -d "Show version information"

# Completion for completion command
complete -c bunosh -f -n "__fish_seen_subcommand_from completion" -a "bash zsh fish"
`;
  }
}

/**
 * Extracts commands from the current Bunoshfile for completion
 */
export function getCompletionCommands() {
  try {
    if (!fs.existsSync(BUNOSHFILE)) {
      return [];
    }

    const source = fs.readFileSync(BUNOSHFILE, 'utf8');
    
    // Simple regex to extract export function names and comments
    const functionRegex = /\/\*\*\s*\n\s*\*\s*(.+?)\s*\n[\s\S]*?\*\/\s*\n\s*export\s+(?:async\s+)?function\s+(\w+)/g;
    const commands = [];
    let match;

    while ((match = functionRegex.exec(source)) !== null) {
      const [, description, functionName] = match;
      const commandName = prepareCommandName(functionName);
      
      commands.push({
        name: commandName,
        description: description.trim(),
        functionName
      });
    }

    // Also check for simple exports without JSDoc
    const simpleExportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    while ((match = simpleExportRegex.exec(source)) !== null) {
      const [, functionName] = match;
      const commandName = prepareCommandName(functionName);
      
      // Don't add duplicates
      if (!commands.find(cmd => cmd.name === commandName)) {
        commands.push({
          name: commandName,
          description: '',
          functionName
        });
      }
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    return [];
  }
}

/**
 * Converts function name to command name (same logic as program.js)
 */
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
  return name
    .split(/(?=[A-Z])/)
    .join("-")
    .toLowerCase();
}

/**
 * Detects the current shell from environment
 */
export function detectCurrentShell() {
  // Check SHELL environment variable
  const shellPath = process.env.SHELL;
  if (shellPath) {
    const shellName = path.basename(shellPath);
    if (['bash', 'zsh', 'fish'].includes(shellName)) {
      return shellName;
    }
  }

  // Check parent process name (for cases where SHELL might not be set correctly)
  try {
    const { execSync } = require('child_process');
    const parentProcess = execSync('ps -p $PPID -o comm=', { encoding: 'utf8' }).trim();
    if (['bash', 'zsh', 'fish'].includes(parentProcess)) {
      return parentProcess;
    }
  } catch (error) {
    // Ignore errors, fall back to SHELL variable
  }

  return null;
}

/**
 * Gets the appropriate paths for shell completion files
 */
export function getCompletionPaths(shell) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  
  switch (shell) {
    case 'bash':
      return {
        completionFile: path.join(homeDir, '.bunosh-completion.bash'),
        configFiles: [
          path.join(homeDir, '.bashrc'),
          path.join(homeDir, '.bash_profile'),
          path.join(homeDir, '.profile')
        ],
        sourceCommand: 'source ~/.bunosh-completion.bash'
      };
    case 'zsh':
      return {
        completionFile: path.join(homeDir, '.bunosh-completion.zsh'),
        configFiles: [
          path.join(homeDir, '.zshrc')
        ],
        sourceCommand: 'source ~/.bunosh-completion.zsh'
      };
    case 'fish':
      const fishConfigDir = path.join(homeDir, '.config', 'fish');
      return {
        completionFile: path.join(fishConfigDir, 'completions', 'bunosh.fish'),
        configFiles: [], // Fish doesn't need config file modification
        sourceCommand: null // Fish loads completions automatically
      };
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }
}

/**
 * Installs completion for the specified shell
 */
export function installCompletion(shell) {
  const commands = getCompletionCommands();
  const generator = new CompletionGenerator(commands);
  const paths = getCompletionPaths(shell);
  
  // Generate completion script
  let completionScript;
  switch (shell) {
    case 'bash':
      completionScript = generator.generateBashCompletion();
      break;
    case 'zsh':
      completionScript = generator.generateZshCompletion();
      break;
    case 'fish':
      completionScript = generator.generateFishCompletion();
      break;
    default:
      throw new Error(`Unsupported shell: ${shell}`);
  }

  // Ensure directory exists
  const completionDir = path.dirname(paths.completionFile);
  if (!fs.existsSync(completionDir)) {
    fs.mkdirSync(completionDir, { recursive: true });
  }

  // Write completion file
  fs.writeFileSync(paths.completionFile, completionScript);

  // For bash and zsh, add source command to config file if not present
  if (paths.sourceCommand && paths.configFiles.length > 0) {
    const sourceCommandWithComment = `
# Bunosh completion
if [ -f ${paths.completionFile} ]; then
    ${paths.sourceCommand}
fi`;

    // Find the first existing config file, or use the first option
    let configFile = paths.configFiles.find(f => fs.existsSync(f));
    if (!configFile) {
      configFile = paths.configFiles[0];
      // Create the file if it doesn't exist
      fs.writeFileSync(configFile, '');
    }

    // Check if already configured
    const configContent = fs.readFileSync(configFile, 'utf8');
    if (!configContent.includes('bunosh-completion') && !configContent.includes(paths.sourceCommand)) {
      fs.appendFileSync(configFile, sourceCommandWithComment);
      return { configFile, added: true };
    } else {
      return { configFile, added: false };
    }
  }

  return { configFile: null, added: false };
}

/**
 * Main completion handler
 */
export function handleCompletion(shell) {
  const commands = getCompletionCommands();
  const generator = new CompletionGenerator(commands);

  switch (shell) {
    case 'bash':
      return generator.generateBashCompletion();
    case 'zsh':
      return generator.generateZshCompletion();
    case 'fish':
      return generator.generateFishCompletion();
    default:
      throw new Error(`Unsupported shell: ${shell}. Supported shells: bash, zsh, fish`);
  }
}