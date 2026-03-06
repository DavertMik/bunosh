# Bunosh

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="150">
</p>

<p align="center">
  A task runner for JavaScript. Transform functions into CLI commands.
</p>

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients*

---

## Quick Example

```js
// Bunoshfile.js — run with: bunosh deploy
export async function deploy(env = 'production') {
  await exec`npm run build`.env({ NODE_ENV: env });
  await exec`rsync -az dist/ server:/var/www/`;
  say(`Deployed to ${env}`);
}
```

## Installation

### Single Executable (Recommended)

Download the standalone executable — no Node.js or Bun required:

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

### Package Managers

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

2. **Write a command:**
```javascript
// Bunoshfile.js
const { exec, say } = global.bunosh;

/**
 * Builds the project for production
 */
export async function build(env = 'production') {
  await exec`npm run build`.env({ NODE_ENV: env });
  say('Build complete');
}
```

3. **Run it:**
```bash
bunosh build
bunosh build staging
```

## Commands

By default, Bunosh loads commands from `Bunoshfile.js` in the current directory.

```
bunosh hello
```

You can specify a custom file using `--bunoshfile` or the `BUNOSHFILE` environment variable:

```bash
bunosh --bunoshfile Bunoshfile.dev.js hello
BUNOSHFILE=Bunoshfile.prod.js bunosh deploy
```

### Creating Commands

Every exported function in `Bunoshfile.js` becomes a CLI command:

```javascript
export function hello() {
  console.log('Hello, World!');
}

export function greet(name = 'friend') {
  console.log(`Hello, ${name}!`);
}

export function deploy(env = 'staging', options = { force: false, verbose: false }) {
  if (options.verbose) console.log('Verbose mode enabled');
  console.log(`Deploying to ${env}${options.force ? ' (forced)' : ''}`);
}
```

```bash
bunosh hello
bunosh greet John
bunosh deploy production --force --verbose
```

### Arguments and Options

Bunosh maps function parameters to CLI arguments automatically:

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

Organize tasks by creating multiple Bunoshfiles. Files named `Bunoshfile.<namespace>.js` register commands under that namespace:

```bash
Bunoshfile.js        # bunosh build, bunosh test
Bunoshfile.dev.js    # bunosh dev:start, bunosh dev:debug
Bunoshfile.api.js    # bunosh api:deploy, bunosh api:test
```

## Comparison

| | Bash Scripts | npm scripts | Task Runners | **Bunosh** |
|--|--|--|--|--|
| **Syntax** | bash/zsh | Simple commands | Custom DSL | JavaScript |
| **Cross-platform** | No | Yes | Yes | Yes |
| **Ecosystem** | CLI tools | npm packages | Plugin dependent | Bash + npm |
| **Composability** | Commands | Separate scripts | Task dependencies | Import any JS code |

## Tasks

Built-in tasks are available via `global.bunosh`:

```javascript
const { exec, shell, fetch, writeToFile, copyFile, task } = global.bunosh;
```

> Global variables are used instead of imports so bunosh works with the single-executable on any platform.

* Async tasks: `exec`, `shell`, `fetch`
* Sync tasks: `writeToFile`, `copyFile`
* Task wrapper: `task`

Each task returns a `TaskResult` object:

```js
const result = await shell`echo "Hello"`;
console.log(result.status);       // 'success', 'fail', or 'warning'
console.log(result.output);       // Command output
console.log(result.hasFailed);    // true if status is 'fail'
console.log(result.hasSucceeded); // true if status is 'success'

const json = await result.json(); // Structured data
```

### `task`

Wraps a function into a named task with tracking and output:

```js
const result = task('Fetch Readme file', () => {
  const content = fs.readFileSync('README.md', 'utf8');
  console.log(content);
  return content;
});
```

If another task runs inside a task function, its description is appended to child tasks.

### `exec`

Runs a command using [child process `spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options):

```javascript
await exec`npm install --verbose`;
await exec`docker build . | tee build.log`;

// With environment variables
await exec`echo $NODE_ENV`.env({ NODE_ENV: 'production' });

// In specific directory
await exec`npm install`.cwd('/tmp/project');

// Structured output
const result = await exec`git status --porcelain`;
const data = await result.json();
// Returns: { stdout: "...", stderr: "...", exitCode: 0, lines: [...] }
```

By default tasks print live output from stdout and stderr. To disable, use `silent`:

```javascript
await task.silent(() => exec`npm install`);

// Or disable for all commands
task.silence();
```

### `shell`

Optimized for simple commands when running under Bun:

```javascript
await shell`pwd`;
await shell`ls -la`;
await shell`cat package.json`;

const result = await shell`ls -la`;
const data = await result.json();
```

For details see the [Bun shell](https://bun.sh/docs/runtime/shell) reference.

**`shell` vs `exec`:**

| Command | Best For | Implementation | Compatibility |
|---------|----------|----------------|---------------|
| `exec` | Single command execution | spawn process | Node.js + Bun, platform dependent |
| `shell` | Cross-platform shell commands | Bun shell | Bun only, cross-platform |

### `fetch`

Wraps the fetch API as a task:

```javascript
export async function healthCheck(url) {
  const response = await fetch(url);

  if (response.ok) {
    const data = await response.json();
    say(`Service healthy: ${data.status}`);
  } else {
    yell(`Service down: ${response.status}`);
  }
}
```

### File Operations

Template-based file writing and copying:

```javascript
export function generatePage(name, description = '') {
  writeToFile('index.mdx', (line) => {
    line`name": "${name}",`;
    if (description) {
      line`description: "${description}"`;
    }
    line`---`;
  });

  copyFile('template.env', '.env');
}
```

## Input/Output

### `say`

Standard output:

```javascript
say('Building project...');
say(`Found ${count} files to process`);
```

### `ask`

User input with smart parameter detection:

```javascript
const name = await ask('Project name:', 'my-app');
const proceed = await ask('Continue?', true);
const env = await ask('Select environment:', ['dev', 'staging', 'prod']);
const features = await ask('Select features:', ['TypeScript', 'ESLint', 'Tests'], { multiple: true });
const password = await ask('Enter password:', { type: 'password' });
const description = await ask('Enter description:', { editor: true });
```

### `yell`

ASCII art output for important messages:

```javascript
yell('BUILD COMPLETE!');
```

### `silent`

Disable realtime output:

```javascript
task.silence();           // Silence all task output
await shell`npm build`;
task.prints();            // Restore output

// Silence a specific task
const labels = await task.silent(() => shell(`gh api repos/:org/:repo/labels`));
```

## Task Control

### Parallel Execution

Use `Promise.all()` to run tasks in parallel:

```javascript
const results = await Promise.all([
  exec`npm run build:frontend`,
  exec`npm run build:backend`,
  exec`npm run build:docs`
]);
```

### Custom Tasks

Name and group operations:

```js
await task('Build', async () => {
  await exec`npm run build:frontend`;
  await exec`npm run build:docs`;
});
```

### Stop on Failure

By default bunosh continues execution when tasks fail. To stop immediately on failure:

```javascript
export async function deployStrict() {
  task.stopOnFailures();

  await exec`npm test`;
  await exec`npm run build`;
  await exec`deploy-script`;
}

export async function cleanup() {
  task.ignoreFailures();

  await task('Remove temp files', () => shell`rm -rf tmp/*`);
  await task('Clear logs', () => shell`rm -f logs/*.log`);
  await task('Reset cache', () => shell`rm -rf .cache`);
}
```

### Try Operations

Handle operations that might fail:

```javascript
export async function checkServices() {
  const dbConnected = await task.try(() => shell`nc -z localhost 5432`);

  if (dbConnected) {
    say('Database connected');
  } else {
    say('Database unavailable, using fallback');
    await useFallbackDatabase();
  }

  const apiHealthy = await task.try(() => fetch('http://localhost:3000/health'));

  if (!apiHealthy) {
    yell('API IS DOWN!');
  }
}
```

## Documentation

- **[Examples](docs/examples.md)** — Real-world examples and workflows
- **[AI Integration](docs/ai.md)** — Built-in AI support
- **[MCP Integration](docs/mcp.md)** — Expose commands to AI assistants (Claude, Cursor, etc.)
- **[JavaScript Execution](docs/javascript-execution.md)** — Execute JavaScript directly via CLI
- **[Bash Migration Guide](docs/bash-migration-guide.md)** — Convert bash scripts to Bunosh
- **[Node.js Migration Guide](docs/nodejs-migration-guide.md)** — Migrate from Node.js scripts

## License

MIT License - see LICENSE file for details.

---

Made in Ukraine
