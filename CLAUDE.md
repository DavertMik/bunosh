# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Style

IMPORTANT: No comments in code unless asked
Avoid if/else constrution, prefer if/return instead


## Development Commands

- **Run Bunosh**: `bun bunosh.js` or `bunosh <command>` (requires global install)
- **Run test files**: `bun <filename.js>` - Execute JavaScript files with Bun runtime
- **Build binary**: `bunosh build:binary` - Creates standalone executable
- **Format code**: `prettier --write "*.{js,css,md}"` (via lint-staged)
- **Initialize new tasks file**: `bunosh init`
- **Edit tasks**: `bunosh edit` - Opens tasks file in editor
- **Export to package.json**: `bunosh export:scripts` - Adds commands to package.json scripts

## Runtime Environment

**Primary Runtime**: Bun JavaScript runtime
- **Bun**: Full functionality with real-time streaming output
- **Node.js**: Fallback with simple command execution
- Bun provides faster startup and built-in TypeScript support

## Core Architecture

Bunosh transforms JavaScript functions into CLI commands.

### Main Components
- `bunosh.js` - Entry point that loads and executes Bunoshfile.js
- `src/program.js` - CLI program builder using Commander.js and Babel AST parsing
- `index.js` - Exports built-in task functions to global.bunosh object
- `Bunoshfile.js` - User-defined tasks file (created by `bunosh init`)

### Task System
- Exported functions become CLI commands
- Function names convert to kebab-case (e.g., `helloWorld` → `hello:world`)
- Parameters become CLI arguments and options
- JSDoc comments become command descriptions

## Global API

Functions available via `global.bunosh` or direct imports:

### Core Functions
- `exec` / `$` - Cross-platform shell execution with streaming output
- `shell` - Native Bun shell execution (fastest, with Node.js fallback)
- `fetch` - HTTP requests
- `writeToFile` - File operations
- `copyFile` - File copying
- `ask`, `say`, `yell` - User interaction

### Task Control
- `task(name, fn)` - Wrap function with task tracking and logging
- `task.try(fn)` or `task.try(name, fn)` - Returns true/false on success/failure (silent by default)
- `task.stopOnFailures()` - Exit immediately on any task failure
- `task.ignoreFailures()` - Continue on task failures (default)
- `task.silence()` - Globally disable task output
- `task.prints()` - Globally enable task output (default)
- `task.silent()` - Wrapper for executing tasks without output

### Task Usage
```javascript
// Basic task
await task('Build', () => shell`npm run build`);

// Try operation (silent by default)
const success = await task.try(() => shell`test -f file.txt`);

// Try operation with verbose output
const success = await task.try('Check file', () => shell`test -f file.txt`, false);

// Failure control
task.stopOnFailures();  // Exit on failure
task.ignoreFailures();  // Continue on failure

// Output control
task.silence();  // Disable output
await task.silent().task('Silent task', () => doSomething());
```

### Built-in Tasks (`src/tasks/`)
- `exec.js` - Cross-platform command execution with streaming
- `shell.js` - Native Bun shell with Node.js fallback
- `fetch.js` - HTTP requests with progress
- `writeToFile.js` - File writing with template builder
- `copyFile.js` - File copying

**Task Usage:**
- Use `shell` for Bun performance, simple commands
- Use `exec` for cross-platform compatibility, complex operations
- Both support `.env(object)` and `.cwd(path)` methods

## Testing

The project uses two different test frameworks:

### Unit Tests (Bun Test)
- **Command**: `bun test` - Run all unit tests
- **Location**: `test/` directory
- **Framework**: Bun's built-in test framework (`bun:test`)
- **Usage**: For testing core functionality, task system, and individual modules

### End-to-End Tests (Vitest)
- **Command**: `npm run test:e2e` - Run all e2e tests
- **Location**: `e2e-tests/` directory
- **Framework**: Vitest
- **Usage**: For testing CLI behavior, command execution, and integration scenarios

## Important Implementation Details

### Exit Code Behavior
- **Default**: Exit code 1 if any tasks fail (but continue execution)
- **Test mode** (NODE_ENV=test or test framework detected): Exit code 0 regardless of failures
- **`task.stopOnFailures()`**: Exit immediately with code 1 on first task failure
- **`task.ignoreFailures()`**: Continue execution AND exit with code 0 regardless of task failures

### Output Formatters
- ConsoleFormatter (default) - Colored terminal output
- GitHubActionsFormatter - CI-specific formatting
- Auto-detected based on environment

### AST Processing
Uses Babel to parse Bunoshfile.js and extract:
- Function signatures for CLI generation
- JSDoc comments for command descriptions
- Default parameter values for option defaults
