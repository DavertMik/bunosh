# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run Bunosh**: `bun bunosh.js` or `bunosh <command>` (requires global install)
- **Run test files**: `bun <filename.js>` - Execute JavaScript files with Bun runtime
- **Build binary**: `bunosh build:binary` - Creates standalone executable
- **Format code**: `prettier --write "*.{js,css,md}"` (via lint-staged)
- **Initialize new tasks file**: `bunosh init`
- **Edit tasks**: `bunosh edit` - Opens tasks file in editor
- **Export to package.json**: `bunosh export:scripts` - Adds commands to package.json scripts

## Runtime Environment

**Primary Runtime**: This project is optimized for Bun JavaScript runtime.
- **Bun** (recommended): Full functionality with real-time streaming output
- **Node.js** (fallback): Basic functionality with simple command execution
- Use `bun <script.js>` or `node <script.js>` to execute JavaScript files
- Bun provides faster startup and built-in TypeScript support

### Runtime Compatibility
The system automatically detects the runtime environment:
- **Bun**: Uses `Bun.spawn()` for real-time streaming command output
- **Node.js**: Falls back to `execSync()` for simple command execution without streaming

## Core Architecture

Bunosh is a task runner that transforms JavaScript functions into CLI commands. The architecture consists of:

### Main Components
- `bunosh.js` - Entry point that loads and executes Bunoshfile.js
- `src/program.js` - Core CLI program builder using Commander.js and Babel AST parsing
- `index.js` - Exports built-in task functions to global.bunosh object
- `Bunoshfile.js` - User-defined tasks file (created by `bunosh init`)

### Task System
- Each exported function in Bunoshfile.js becomes a CLI command
- Function names convert to kebab-case commands (e.g., `helloWorld` → `hello:world`)
- Function parameters become CLI arguments and options
- Last parameter as object with defaults becomes CLI options
- JSDoc comments or first-line comments become command descriptions

### Built-in Tasks (`src/tasks/`)
- `exec.js` - Cross-platform command execution with real-time streaming output
- `shell.js` - Native Bun shell execution with Node.js fallback to exec
- `fetch.js` - HTTP requests with progress indicators
- `writeToFile.js` - File writing with template string builder
- `copyFile.js` - File copying operations

**Task Usage:**
- Use `shell` for Bun performance, simple commands
- Use `exec` for cross-platform compatibility, complex operations, streaming output
- Both support `.env(object)` and `.cwd(path)` methods

### Output System
- Console-based output with pluggable formatter support
- `src/io.js` - User interaction functions (ask, say, yell)
- `src/task.js` - Task execution wrapper with status tracking and counter
- `src/printer.js` - Central output controller with formatter delegation
- Real-time streaming output for long-running commands

#### Output Formatters
Output formatting is handled by pluggable formatter classes in `src/formatters/`:

**ConsoleFormatter** (`src/formatters/console.js`):
- Default formatter for local development
- Colored terminal output with icons (▶ ✓ ✗)
- Full-width lines with background colors
- Delayed start printing (50ms) - quick tasks show only completion
- Auto-detected when `!process.env.CI`

**GitHubActionsFormatter** (`src/formatters/github-actions.js`):
- Specialized output for GitHub Actions CI
- Uses `::group::`, `::notice::`, `::error::` commands
- Creates collapsible sections for long-running tasks
- Auto-detected when `process.env.GITHUB_ACTIONS === 'true'`

**Architecture**:
- `src/formatters/factory.js` - Auto-detects environment and creates formatter
- `src/formatters/base.js` - Base class defining formatter interface
- Each formatter handles start/finish/error/output formatting independently
- Task counting system tracks all operations (exec, shell, fetch, writeToFile, copyFile)

#### Adding New Formatters
To add support for new CI systems (GitLab, TeamCity, Azure DevOps):
1. Create formatter class extending `BaseFormatter`
2. Implement `format(taskName, status, taskType, extra)` method
3. Implement `formatOutput(line, isError)` method
4. Add static `detect()` method for environment detection
5. Register in `factory.js` FORMATTERS array

### AST Processing
The program uses Babel to parse Bunoshfile.js and extract:
- Function signatures to generate CLI interfaces
- JSDoc comments for command descriptions
- Default parameter values for option defaults
- Object destructuring patterns for CLI options

### Global API
Functions available in tasks via `global.bunosh` or direct imports:
- `exec` / `$` - Cross-platform shell execution with streaming output
- `shell` - Native Bun shell execution (fastest, with Node.js fallback)
- `fetch` - HTTP requests
- `writeToFile` - File operations
- `copyFile` - File copying
- `ask`, `say`, `yell` - User interaction
- `task` - Task execution wrapper with console output
- `stopOnFail`, `ignoreFail` - Error handling control