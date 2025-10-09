# 🍲 Bunosh

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="150">
</p>

<p align="center">
  <strong>Your exceptional task runner</strong>
</p>

<p align="center">
  Transform JavaScript functions into CLI commands.
</p>

---

## What is Bunosh?

Bunosh is a modern task runner that turns your JavaScript functions into CLI commands instantly. No configuration, no boilerplate - just write functions and run them from the terminal.

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients*

## Hello World

No nore words, just code:

```js
// this is a command in Bunoshfile.js
// bunosh hello:world

export async function helloWorld(name = 'person') {
  name = await ask("What's your name?", name);
  say(`👋 Hello, ${name}!`);
  const city = await ask('Which city do you live in?')
  const result = await fetch(`https://wttr.in/${city}?format=3`)
  say(`Weather in your city ${result.output}`)

  const toCleanup = await ask('Do you want me to cleanup tmp for you?', true);

  if (!toCleanup) {
    say('Bye, then!');
    return;
  }

  await shell`rm -rf ${require('os').tmpdir()}/*`;
  say('🧹 Cleaned up! Have a great day!');
}
````

## Why Choose Bunosh?

| Comparison | 🐚 Bash Scripts | 📦 npm scripts | 🛠️ Task Runners | 🍲 **Bunosh** |
|------------|-----------------|----------------|------------------------------|----------------|
| **Syntax** | bash/zsh  | Simple commands | Custom DSL | ✅ JavaScript |
| **Cross-platform** | No | Yes | Yes | ✅ Yes |
| **Ecosystem** | CLI tools | npm packages | Plugin dependent | ✅ Bash + npm |
| **Composability** | Commands | Separate scripts | Task dependencies | ✅ Import any JS code |

**📚 Migration Guides:**
- [Migrating from Bash Scripts](docs/bash-migration-guide.md)
- [Migrating from Node.js Scripts](docs/nodejs-migration-guide.md)

## TOC

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Commands](#commands)
- [Tasks](#tasks)
- [Input/Output](#inputoutput)
- [Task Control](#task-control)
- [AI Integration](#ai-integration)
- [Examples](#examples)

## Installation

### Option 1: Single Executable (Recommended)

Download the standalone executable - no Node.js or Bun required:

**macOS:**
```bash
curl -fsSL https://github.com/davertmik/bunosh/releases/latest/download/bunosh-darwin-arm64.tar.gz | tar -xz
sudo mv bunosh-darwin-arm64 /usr/local/bin/bunosh
```

**Linux:**
```bash
curl -fsSL https://github.com/davertmik/bunosh/releases/latest/download/bunosh-linux-x64.tar.gz | tar -xz
sudo mv bunosh-linux-x64 /usr/local/bin/bunosh
```

**Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://github.com/davertmik/bunosh/releases/latest/download/bunosh-windows-x64.exe.zip" -OutFile "bunosh.zip"
Expand-Archive -Path "bunosh.zip" -DestinationPath .
Move-Item "bunosh-windows-x64.exe" "bunosh.exe"
```

### Option 2: Package Managers

```bash
# Using Bun
bun add -g bunosh

# Using npm
npm install -g bunosh
```

## Quickstart

1. **Initialize your Bunoshfile:**
```bash
bunosh init
```

2. **Write your first command:**
```javascript
// Bunoshfile.js
const { exec, say } = global.bunosh;

/**
 * Builds the project for production
 */
export async function build(env = 'production') {
  say(`🔨 Building for ${env}...`);
  await exec`npm run build`.env({ NODE_ENV: env });
  say('✅ Build complete!');
}
```

That's it! Your function is now a CLI command.

3. **Run it:**
```bash
# build for production
bunosh build

# build for staging
bunosh build staging

# build for development
bunosh build development
```

## Commands


By default, Bunosh loads commands from `Bunoshfile.js` in the current directory.

```
# reads Bunoshfile form cwd and runs hello()
bunosh hello
```

You can specify custom configuration file using CLI option:

```bash
# Load commands from a different file
bunosh --bunoshfile Bunoshfile.dev.js hello
```

or via environment variable:

```bash
# Set default bunoshfile for session
export BUNOSHFILE=Bunoshfile.dev.js
bunosh hello  # Uses Bunoshfile.dev.js

# One-time usage
BUNOSHFILE=Bunoshfile.prod.js bunosh deploy
```


### Creating Commands

Every exported function in `Bunoshfile.js` becomes a CLI command:

```javascript
// Simple command
export function hello() {
  console.log('Hello, World!');
}

// Command with parameters
export function greet(name = 'friend') {
  console.log(`Hello, ${name}!`);
}

// Command with options
export function deploy(env = 'staging', options = { force: false, verbose: false }) {
  if (options.verbose) console.log('Verbose mode enabled');
  console.log(`Deploying to ${env}${options.force ? ' (forced)' : ''}`);
}
```

**CLI Usage:**
```bash
bunosh hello
bunosh greet John
bunosh deploy production --force --verbose
```

### Arguments and Options

Bunosh automatically maps function parameters to CLI arguments:

```javascript
/**
 * Create a new feature branch
 * @param {string} name - Feature name (required)
 * @param {string} base - Base branch (optional, defaults to 'main')
 * @param {object} options - CLI options
 * @param {boolean} options.push - Push to remote after creation
 */
export async function feature(name, base = 'main', options = { push: false }) {
  await exec`git checkout -b feature/${name} ${base}`;

  if (options.push) {
    await exec`git push -u origin feature/${name}`;
  }
}
```

**Generated CLI:**
```bash
bunosh feature my-feature           # Creates from main
bunosh feature my-feature develop   # Creates from develop
bunosh feature my-feature --push    # Creates and pushes
```

### Command Naming

Functions are automatically converted to kebab-case commands:

| Function Name | CLI Command |
|--------------|-------------|
| `build` | `bunosh build` |
| `gitPush` | `bunosh git:push` |
| `npmInstall` | `bunosh npm:install` |
| `buildAndDeploy` | `bunosh build:and-deploy` |




### Project Namespaces

Organize your project tasks by creating multiple Bunoshfiles with namespaces. This helps keep large projects organized and separates concerns.

**Create namespace files:**
```bash
# Main tasks (no namespace)
Bunoshfile.js

# Development tasks
Bunoshfile.dev.js

# API tasks  
Bunoshfile.api.js

# Database tasks
Bunoshfile.db.js
```

**Example structure:**
```javascript
// Bunoshfile.js - Core project tasks
export function build() {
  console.log('Building project...');
}

export function test() {
  console.log('Running tests...');
}

// Bunoshfile.dev.js - Development tasks
export function start() {
  console.log('Starting dev server...');
}

export function debug() {
  console.log('Debugging...');
}

// Bunoshfile.api.js - API specific tasks
export function deploy() {
  console.log('Deploying API...');
}

export function test() {
  console.log('Running API tests...');
}
```

**Usage:**
```bash
# Core tasks (no namespace)
bunosh build
bunosh test

# Namespaced tasks
bunosh dev:start
bunosh dev:debug
bunosh api:deploy
bunosh api:test
```

**Key features:**
- 🗂️ **Organization** - Group related tasks by namespace
- 🔒 **No conflicts** - Same function names can exist in different namespaces
- 📁 **Auto-discovery** - All `Bunoshfile.*.js` files are loaded automatically
- 🏷️ **Clear naming** - Namespace prefix makes task purpose obvious
- 📋 **Unified help** - All namespaces appear together in help output

## Tasks

Bunosh provides built-in tasks which are available via `global.bunosh`:

```javascript
const { exec, shell, fetch, writeToFile, copyFile, task } = global.bunosh;
```

> We use global variables instead of imports to ensure you can use it with bunosh single-executable on any platform.


* Async tasks: `exec`, `shell`, `fetch`
* Sync tasks: `writeToFile`, `copyFile`
* Task wrapper: `task`

Each executed task returns `TaskResult` object which can be analyzed and used in next steps:

```js
const result = await shell`echo "Hello"`;
console.log(result.status);    // 'success', 'fail', or 'warning'
console.log(result.output);    // Command output or result data
console.log(result.hasFailed); // true if status is 'fail'
console.log(result.hasSucceeded); // true if status is 'success'
console.log(result.hasWarning); // true if status is 'warning'

// Get structured JSON data from any task (async method)
const json = await result.json();
```

Now let's look into other tasks:

#### `task`

General method that transforms a function into a task. Adds it to tasks registry and prints task information:

```js
// register operation as a task
const result = task('Fetch Readme file', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  console.log(content);
  return content;
});
```

If a another task is executed inside a task function, its description will be appended to all child tasks.

#### `exec`

Run single command using [child process `spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)

```javascript
// Complex commands with pipes and streaming output
await exec`npm install --verbose`;
await exec`docker build . | tee build.log`;
await exec`find . -name "*.js" | grep -v node_modules | wc -l`;

// With environment variables
await exec`echo $NODE_ENV`.env({ NODE_ENV: 'production' });

// In specific directory
await exec`npm install`.cwd('/tmp/project');

// Get structured output with stdout, stderr, exit code and lines
const result = await exec`git status --porcelain`;
const data = await result.json();
// Returns: { stdout: "...", stderr: "...", exitCode: 0, lines: [...] }
```

By default task prints live line-by-line output from stdout and stderr. To disable output, use `silent` method:

```javascript

// disable printing output
await task.silent(() => exec`npm install`);

// disable output for all commands
await task.silence();
```

See more [#silent](#silent)

#### `shell` - Fast Native Execution

Optimized for simple, fast commands when running under Bun:

```javascript
// Simple, fast commands
await shell`pwd`;
await shell`ls -la`;
await shell`cat package.json`;

// Get structured output with stdout, stderr, exit code and lines
const result = await shell`ls -la`;
const data = await result.json();
// Returns: { stdout: "...", stderr: "...", exitCode: 0, lines: [...] }
```

For more details see [bun shell](https://bun.sh/docs/runtime/shell) reference

`shell` vs `exec`

| Command | Best For | Use Cases | Implementation | Compatibility |
|---------|----------|-----------|----------------|---------------|
| `exec` | Single command execution | single command | spawn process | NodeJS + Bun but platform dependent |
| `shell` | Multiple cross-platform shell commands | exec + `pwd`, `ls`, `echo`, `cat`, basic file ops | bun shell | Bun only but Cross-platform |

shell prints output from stdout and stderr. To disable output, [make tasks silent](#silent):

###$ `fetch`

`fetch` task wraps fetch:

```javascript
/**
 * Check service health
 */
export async function healthCheck(url) {
  const response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    say(`✅ Service healthy: ${data.status}`);
  } else {
    yell(`❌ Service down: ${response.status}`);
  }
}

// Get JSON response data directly
const apiResponse = await fetch('https://api.example.com/data');
const jsonData = await apiResponse.json();
// Calls response.json() method internally
```

### File Operations

Template-based file writing and copying:

```javascript
/**
 * Generate configuration file
 */
export function generatePage(name, description = '') {
  writeToFile('index.mdx', (line) => {
    line`name": "${name}",`;
    if (description) {
      line`description: "${description}"`;
    }
    line`---`;
  });

  say('📝 Page created');
}

// Copy files
copyFile('template.env', '.env');
```


## Input/Output

### `say` - Normal Output

Standard output with visual indicator:

```javascript
say('Building project...');
say('📦 Dependencies installed');
say(`Found ${count} files to process`);
```

### `ask` - User Input

Flexible user input with smart parameter detection:

```javascript
// Text input with default
const name = await ask('Project name:', 'my-app');

// Boolean confirmation (auto-detects)
const proceed = await ask('Continue?', true);

// Single selection (auto-detects from array)
const env = await ask('Select environment:', ['dev', 'staging', 'prod']);

// Multiple selection
const features = await ask('Select features:',
  ['TypeScript', 'ESLint', 'Tests'],
  { multiple: true }
);

// Password input
const password = await ask('Enter password:', { type: 'password' });

// Multiline editor input
const description = await ask('Enter description:', { editor: true });
```

| Parameter/Option | Type | Description | Example |
|------------------|------|-------------|---------|
| **Smart Detection** | | |
| `defaultValue` | String/Number | Sets default value for text/number input | `'John'`, `3000` |
| `defaultValue` | Boolean | Auto-detects as confirmation prompt | `true`, `false` |
| `choices` | Array | Auto-detects as selection list | `['A', 'B', 'C']` |
| **Options Object** | | |
| `multiple` | Boolean | Enables multiple selections (requires `choices`) | `true` |
| `multiline` | Boolean | Opens system editor for multi-line input | `true` |
| `editor` | Boolean | Opens system editor for multi-line input (same as `multiline`) | `true` |
| `default` | Any | Default value or content (when using options object) | `'default value'` |
| `type` | String | Input type: `'input'`, `'confirm'`, `'password'`, `'number'` | `'password'` |
| `validate` | Function | Custom validation function | `(input) => input.length > 0` |


### `yell`

Emphasized Output

ASCII art output for important messages:

```javascript
yell('BUILD COMPLETE!');
yell('DEPLOYMENT SUCCESSFUL!');
```

### `silent`

Stop printing realtime output

```javascript
// Silence all task output
task.silence();
await shell`npm build`;

// restore printing output
task.prints();

// Silent specific task
const labels = await task.silent(() => shell(`gh api repos/:org/:repo/labels`));
```

## Task Control

### Parallel Executions

No magic here. Use `Promise.all()` to run tasks in parallel:

```javascript
// Parallel tasks
const results = await Promise.all([
  exec`npm run build:frontend`,
  exec`npm run build:backend`,
  exec`npm run build:docs`
]);
```

### Custom Tasks

Name and group your tasks operations:

```js
await task('Build', () => {
  await exec`npm run build:frontend`);
  await exec`npm run build:docs`);
});
````

### Stop on Failure

By default bunosh executes all tasks event if they fail. To stop execution immediately on failure, use the `task.stopOnFailures()` method.


```javascript
/**
 * Strict deployment - stop on any failure
 */
export async function deployStrict() {
  task.stopOnFailures();  // Exit immediately on any task failure

  await exec`npm test`;
  await exec`npm run build`;
  await exec`deploy-script`;
  // If any task fails, script exits immediately
}

/**
 * Cleanup - continue despite failures
 */
export async function cleanup() {
  task.ignoreFailures();  // Continue even if tasks fail

  await task('Remove temp files', () => shell`rm -rf tmp/*`);
  await task('Clear logs', () => shell`rm -f logs/*.log`);
  await task('Reset cache', () => shell`rm -rf .cache`);
  // All tasks run regardless of failures
}
```

### Try Operations

Gracefully handle operations that might fail:

```javascript
/**
 * Check service availability
 */
export async function checkServices() {
  const dbConnected = await task.try(shell`nc -z localhost 5432`);

  if (dbConnected) {
    say('✅ Database connected');
  } else {
    say('⚠️ Database unavailable, using fallback');
    await useFallbackDatabase();
  }

  const apiHealthy = await task.try(() => fetch('http://localhost:3000/health'));

  if (!apiHealthy) {
    yell('API IS DOWN!');
  }
}
```

## 💫 AI Integration

Built-in AI support for code generation, documentation, and automation.
Automatically responds to structured JSON output.

AI provider automatically detected, but you need to provide API key and model name.
Use `.env` file with `AI_MODEL` and `OPENAI_API_KEY` variables.
In case you use provider other than OpenAI, Anthropic, Groq, you may need to configure it manually in top of Bunoshfile

```bash
# Choose your AI model
export AI_MODEL=gpt-5  # or claude-4-sonnet, llama-3.3-70b, etc.

# Set API key for your provider
export OPENAI_API_KEY=your_key_here      # For OpenAI
# export ANTHROPIC_API_KEY=your_key_here  # For Claude
# export GROQ_API_KEY=your_key_here       # For Groq
```


Use the `ai` function to interact with the AI.

```js
const resp = await ai(message, { field1: 'what should be there', field2: 'what should be there' })
```

### Usage

```javascript
const { ai, writeToFile } = global.bunosh;

/**
 * Generate commit message from staged changes
 */
export async function commit() {
  const diff = await exec`git diff --staged`;

  if (!diff.output.trim()) {
    say('No staged changes');
    return;
  }

  const response = await ai(
    `Generate a conventional commit message for: ${diff.output}`,
    {
      type: 'Commit type (feat/fix/docs/chore)',
      scope: 'Commit scope (optional)',
      subject: 'Brief subject line (50 chars max)',
      body: 'Detailed explanation'
    }
  );

  const commit = await response.json();

  const message = commit.scope
    ? `${commit.type}(${commit.scope}): ${commit.subject}\n\n${commit.body}`
    : `${commit.type}: ${commit.subject}\n\n${commit.body}`;

  await exec`git commit -m "${message}"`;
  say('✅ AI-generated commit created');
}
```

See more ai usage examples in [docs/examples.md](docs/examples.md)


## Execute JavaScript Code

Bunosh supports executing JavaScript code directly using the `-e` flag, allowing for powerful one-liners and integration with shell scripts and CI/CD systems.

### Basic Usage

```bash
# Execute inline JavaScript
bunosh -e "say('Hello')"

# Execute JavaScript from stdin
echo "say('Hello')" | bunosh -e
```

### Heredoc Syntax

For multi-line scripts, use heredoc syntax for clean, readable code:

```bash
bunosh -e << 'EOF'
say('🚀 Starting build process...')
await task('Install Dependencies', () => shell`npm ci`)
await task('Build', () => shell`npm run build`)
await task('Test', () => shell`npm test`)
say('✅ All tasks completed successfully!')
EOF
```

### With Environment Variables and Control Flow

```bash
# Complex script with conditions
bunosh -e << 'EOF'
const env = process.env.NODE_ENV || 'development'
say(`Building for ${env}...`)

if (env === 'production') {
  await shell`npm run build:prod`
  await task('Deploy', () => shell`./deploy.sh`)
} else {
  await shell`npm run build:dev`
}

yell('BUILD COMPLETE!')
EOF
```

### Error Handling

```bash
# Script with error handling
bunosh -e << 'EOF'
task.stopOnFailures()

try {
  await shell`npm test`
  await shell`npm run build`
  say('✅ Success!')
} catch (error) {
  yell(`❌ Build failed: ${error.message}`)
  process.exit(1)
}
EOF
```

### JavaScript Execution in GitHub Actions

Use JavaScript execution to run Bunosh scripts inside CI/CD workflows without creating separate files:

```yaml
- name: Build and Deploy
  run: |
    bunosh -e << 'EOF'
    say('🚀 Starting deployment...')

    if (!process.env.NODE_ENV === 'production') return;

    shell`./deploy.sh`

    const response = await fetch('${{ secrets.DEPLOY_WEBHOOK }}', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ${{ secrets.API_TOKEN }}' }
    })

    if (response.ok) {
      yell('🚀 DEPLOYMENT COMPLETE!')
    } else {
      yell('❌ DEPLOYMENT FAILED!')
      process.exit(1)
    }
    EOF
  env:
    NODE_ENV: production
```

### Shell Integration

```bash
bunosh -e << 'EOF'
say('Running database migrations...')
await shell`npm run migrate`
say('Migrations completed')
EOF
```


## Examples

For comprehensive examples of Bunosh in action, see [docs/examples.md](docs/examples.md).

This includes:
- Feature branch workflow with git worktrees
- AI-powered release note generation
- Container building and publishing
- Kubernetes deployment and rollback
- AWS infrastructure management
- And more practical examples

## License

MIT License - see LICENSE file for details.

---

Cooked with ❤️ from Ukraine 🇺🇦
