# 🍲 Bunosh

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients such as mushrooms, cheese, sour cream*

<p align="center">
  <img src="assets/logo.jpg" alt="Logo">
</p>

## What is Bunosh?

Bunosh is a modern task runner that transforms JavaScript functions into CLI commands. Built for [Bun](https://bun.sh) with Node.js fallback compatibility, it combines the power of JavaScript with intuitive command-line interfaces.

**Why Bunosh?**
- ✨ **Zero Configuration**: Write functions, get CLI commands
- 🚀 **Fast Execution**: Optimized for Bun runtime with Node.js fallback
- 🎨 **Rich Output**: Beautiful terminal formatting with CI/CD integration
- 📦 **Built-in Tasks**: Shell execution, HTTP requests, file operations
- 🔧 **Cross-Platform**: Works on macOS, Linux, and Windows

## Quick Start

### Installation

Install [Bun](https://bun.sh) (recommended) or ensure Node.js is available:

```bash
# Install Bunosh globally
bun install -g bunosh

# Create a new tasks file
bunosh init
```

### Your First Task

Create a `Bunoshfile.js`:

```javascript
/**
 * Builds the project
 */
export async function build(opts = { production: false }) {
  await exec`npm run build`;
  
  if (opts.production) {
    await exec`npm run optimize`;
  }
}

/**
 * Deploys to environment
 */
export async function deploy(env = 'staging') {
  await build({ production: true });
  await exec`docker build -t myapp .`;
  await exec`docker push myapp:${env}`;
}

/**
 * Cleans temporary files
 */
export async function clean() {
  await exec`rm -rf dist tmp logs`;
  say('✨ All clean!');
}
```

### Run Your Tasks

```bash
# List available commands
bunosh

# Run tasks
bunosh build
bunosh build --production
bunosh deploy production
bunosh clean
```

## Architecture

### Task System
- **Function → Command**: Each exported function becomes a CLI command
- **Smart Naming**: `helloWorld` → `bunosh hello:world`
- **Auto-Arguments**: Function parameters become command arguments
- **Options Support**: Last object parameter becomes CLI options
- **Documentation**: JSDoc comments become command descriptions

### Output System
Bunosh features a sophisticated output system with multiple formatters:

- **Console Formatter**: Colored terminal output with icons (▶ ✓ ✗)
- **GitHub Actions Formatter**: Specialized CI output with collapsible groups
- **Smart Detection**: Automatically switches based on environment
- **Delayed Start**: Quick tasks show only completion for cleaner output

### Runtime Compatibility
- **Primary**: Bun runtime with real-time streaming output
- **Fallback**: Node.js compatibility with basic command execution
- **Auto-Detection**: Seamlessly switches between runtimes

## Built-in Functions

### Shell Execution
```javascript
import { exec } from 'bunosh';

// Simple command
await exec`echo "Hello World"`;

// With environment variables
await exec`echo $NODE_ENV`.env({ NODE_ENV: 'production' });

// With working directory
await exec`pwd`.cwd('/tmp');

// Complex shell commands
await exec`ls -la | grep ".js" | wc -l`;
```

### HTTP Requests
```javascript
import { fetch } from 'bunosh';

// GET request with streaming output
const response = await fetch('https://api.github.com/repos/user/repo');
```

### File Operations
```javascript
import { writeToFile, copyFile } from 'bunosh';

// Write file with template builder
writeToFile('config.json', (line) => {
  line`{`;
  line`  "name": "myapp",`;
  line`  "version": "1.0.0"`;
  line`}`;
});

// Copy files
copyFile('src/config.template.js', 'dist/config.js');
```

### User Interaction
```javascript
import { ask, say, yell } from 'bunosh';

// Get user input
const name = await ask('What is your name?');

// Output messages
say('Building project...');
yell('Build completed!'); // Emphasized output
```

## Development

### Testing

Bunosh includes a comprehensive test suite using Bun's native test runner:

```bash
# Run all tests
bun test

# Run specific test file
bun test formatters.test.js

# Run with timeout
bun test --timeout 10000
```

**Test Coverage:**
- ✅ Core Architecture (Task system, formatters, printer)
- ✅ Runtime Compatibility (Bun vs Node.js execution)
- ✅ Output Formats (Console, GitHub Actions)
- ✅ Built-in Tasks (exec, fetch, file operations)
- ✅ Integration Scenarios (Parallel execution, error handling)

### Project Structure

```
bunosh/
├── src/
│   ├── formatters/          # Output format handlers
│   │   ├── console.js       # Terminal formatting
│   │   ├── github-actions.js # CI formatting
│   │   └── factory.js       # Auto-detection
│   ├── tasks/               # Built-in task functions
│   │   ├── exec.js          # Shell command execution
│   │   ├── fetch.js         # HTTP requests
│   │   ├── writeToFile.js   # File writing
│   │   └── copyFile.js      # File copying
│   ├── printer.js           # Output controller
│   ├── task.js              # Task management system
│   ├── program.js           # CLI program builder
│   └── io.js                # User interaction
├── test/                    # Comprehensive test suite
└── Bunoshfile.js           # Example tasks file
```

## Environment Integration

### GitHub Actions
Bunosh automatically detects GitHub Actions environment and provides specialized output:

```yaml
- name: Run build tasks
  run: bunosh build --production
```

Output includes:
- Collapsible task groups
- Status indicators (✅ ❌)
- Execution timing
- Clean error reporting

### Local Development
Rich terminal experience with:
- Real-time command output streaming
- Colored status indicators
- Full-width progress lines
- Task execution counting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass: `bun test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ using [Bun](https://bun.sh)