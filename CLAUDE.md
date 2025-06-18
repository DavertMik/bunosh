# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run Bunosh**: `bun bunosh.js` or `bunosh <command>` (requires global install)
- **Build binary**: `bunosh build:binary` - Creates standalone executable
- **Format code**: `prettier --write "*.{js,css,md}"` (via lint-staged)
- **Initialize new tasks file**: `bunosh init`
- **Edit tasks**: `bunosh edit` - Opens tasks file in editor
- **Export to package.json**: `bunosh export:scripts` - Adds commands to package.json scripts

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
- `exec.jsx` - Shell command execution with Ink UI (wraps Bun Shell)
- `fetch.jsx` - HTTP requests with loading indicators
- `writeToFile.jsx` - File writing with template string builder
- `copyFile.jsx` - File copying operations

### UI System
- Built on React/Ink for terminal UI components
- `src/io.jsx` - User interaction functions (ask, say, yell)
- `src/task.jsx` - Task execution wrapper with status indicators
- Real-time output rendering for long-running commands

### AST Processing
The program uses Babel to parse Bunoshfile.js and extract:
- Function signatures to generate CLI interfaces
- JSDoc comments for command descriptions
- Default parameter values for option defaults
- Object destructuring patterns for CLI options

### Global API
Functions available in tasks via `global.bunosh` or direct imports:
- `exec` / `$` - Shell execution
- `fetch` - HTTP requests
- `writeToFile` - File operations
- `copyFile` - File copying
- `ask`, `say`, `yell` - User interaction
- `task` - Wrapped execution with UI
- `stopOnFail`, `ignoreFail` - Error handling control