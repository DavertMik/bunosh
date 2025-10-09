# Node.js to Bunosh Migration Guide

## Step 1: Command Registration in Bunoshfile.js

All Node.js scripts must be converted to exported functions in Bunoshfile.js. Each exported function becomes a CLI command.

### Function to Command Mapping

| Function Name | CLI Command | Usage |
|---------------|-------------|-------|
| `deployApp` | `deploy-app` | `bunosh deploy-app` |
| `runTests` | `run-tests` | `bunosh run-tests` |
| `buildProject` | `build-project` | `bunosh build-project` |

### Arguments and Options Processing

**Function Parameters → CLI Arguments:**
```javascript
// First parameter becomes required argument
export async function deploy(environment) {
  // Usage: bunosh deploy production
}

// Multiple parameters become multiple arguments
export async function copyFiles(source, destination) {
  // Usage: bunosh copy-files ./src ./dist
}

// Parameters with defaults become optional arguments
export async function build(type = 'development') {
  // Usage: bunosh build (defaults to development)
  // Usage: bunosh build production
}
```

**Options Object → CLI Flags:**
```javascript
// Second parameter as options object
export async function runTests(pattern, options = {}) {
  const { coverage = false, watch = false, verbose = false } = options;
  // Usage: bunosh run-tests "**/*.test.js" --coverage --watch --verbose
}
```

**JSDoc for Help Text:**
```javascript
/**
 * Runs tests with specified pattern and options
 * @param {string} pattern - Test file pattern
 * @param {object} options
 * @param {boolean} [options.coverage=false] - Generate coverage report
 * @param {boolean} [options.watch=false] - Watch mode for test changes
 * @param {boolean} [options.verbose=false] - Verbose output
 */
export async function runTests(pattern, options = {}) {
  // implementation
}
```

## Step 2: Convert Node.js Code to Bunosh

### Child Process Execution

Replace `child_process.exec` and `child_process.spawn` with `shell` template literals:

```javascript
// Node.js
const { exec, spawn } = require('child_process');

exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('Build failed:', error);
    return;
  }
  console.log('Build output:', stdout);
});

const child = spawn('npm', ['test'], { stdio: 'inherit' });
```

```javascript
// Bunosh
const result = await shell`npm run build`;
if (result.hasFailed) {
  yell('Build failed');
  return;
}
say('Build completed');

// For test with live output
await shell`npm test`;
```

### Console Output

Replace `console.log` with `say()`:

```javascript
// Node.js
console.log('Building project...');
console.error('Error occurred');
console.warn('Warning message');
```

```javascript
// Bunosh
say('Building project...');
yell('Error occurred');
say('Warning message'); // or say() for less emphasis
```

### File Operations

Replace `fs` module with Bun.file API:

```javascript
// Node.js
const fs = require('fs').promises;
const path = require('path');

// Read file
const content = await fs.readFile('config.json', 'utf8');
const config = JSON.parse(content);

// Write file
await fs.writeFile('output.txt', 'Hello World');

// Check existence
try {
  await fs.access('file.txt');
  console.log('File exists');
} catch {
  console.log('File does not exist');
}

// Copy file
await fs.copyFile('source.txt', 'destination.txt');
```

```javascript
// Bunosh
// Read file
const configFile = Bun.file('config.json');
const config = await configFile.json();

// Write file
await Bun.write('output.txt', 'Hello World');

// Check existence
const file = Bun.file('file.txt');
if (await file.exists()) {
  say('File exists');
  return;
}

// Copy file
await Bun.write('destination.txt', Bun.file('source.txt'));
```

### HTTP Requests

`fetch` works the same but with better error handling patterns:

```javascript
// Node.js (with node-fetch)
const fetch = require('node-fetch');

async function getData() {
  try {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Data received:', data);
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}
```

```javascript
// Bunosh
async function getData() {
  const response = await fetch('https://api.example.com/data');

  if (!response.ok) {
    yell(`Request failed: ${response.status}`);
    return;
  }

  const data = await response.json();
  say('Data received');
  return data;
}
```

### Environment Variables and Working Directory

Replace `process.env` and `process.chdir()` with shell methods:

```javascript
// Node.js
process.env.NODE_ENV = 'production';
process.chdir('/path/to/project');

const result = exec('npm run build', {
  env: { ...process.env, NODE_ENV: 'production' },
  cwd: '/path/to/project'
});
```

```javascript
// Bunosh
await shell`
  npm run build
`.env({ NODE_ENV: 'production' }).cwd('/path/to/project');
```

### Process Exit

Replace `process.exit()` with early returns:

```javascript
// Node.js
if (error) {
  console.error('Fatal error');
  process.exit(1);
}
```

```javascript
// Bunosh
if (error) {
  yell('Fatal error');
  return; // Bunosh will handle exit code
}
```

## Task Results and Error Handling

### Task Result Format

All operations return TaskResult objects:

```javascript
const result = await shell`npm run build`;

// Available properties
console.log(result.status);    // 'success', 'fail', or 'warning'
console.log(result.output);    // Command output or result data
console.log(result.hasFailed); // true if status is 'fail'
console.log(result.hasSucceeded); // true if status is 'success'
console.log(result.hasWarning); // true if status is 'warning'
```

### Result Analysis Instead of Try/Catch

```javascript
// Node.js - try/catch pattern
try {
  const result = await someAsyncOperation();
  console.log('Success:', result);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
```

```javascript
// Bunosh - result analysis pattern
const result = await shell`npm run build`;
if (result.hasFailed) {
  yell(`Build failed: ${result.stderr}`);
  return; // Early return instead of process.exit
}
say(`Build succeeded: ${result.stdout}`);
```

### Stop on Failure for Node.js Compatibility

```javascript
// Make tasks exit on failure (like most Node.js scripts)
task.stopOnFailures();

await shell`npm run build`;  // If this fails, script exits
await shell`npm test`;       // This won't run if build failed
```

## Built-in Tasks Reference

### Core Tasks

- `shell` - Fast native shell execution (Bun only, cross-platform)
- `exec` - Cross-platform command execution (Node.js + Bun)
- `fetch` - HTTP requests
- `task` - Task wrapper for grouping operations
- `say` - Normal output
- `ask` - User input
- `yell` - Emphasized output

### Bun File API

- `Bun.file(path)` - Create file handle
- `file.text()` - Read file as text
- `file.json()` - Read file as JSON
- `file.exists()` - Check if file exists
- `Bun.write(path, content)` - Write file
- `Bun.write(path, file)` - Copy file

### Task Usage Examples

```javascript
const { shell, exec, fetch, task, say, yell } = global.bunosh;

// Replace child_process.exec
const result = await shell`npm run build`;
if (result.hasFailed) {
  yell('Build failed');
  return;
}

// Replace process.chdir and environment variables
await shell`
  npm run build
  npm test
`.env({ NODE_ENV: 'production' }).cwd('/app');

// Replace fs operations
const packageFile = Bun.file('package.json');
if (!await packageFile.exists()) {
  yell('package.json not found');
  return;
}

const packageJson = await packageFile.json();
say(`Building ${packageJson.name} v${packageJson.version}`);

// Task grouping for complex operations
await task('Deploy application', async () => {
  await shell`npm run build`;
  await shell`npm test`;
  await shell`docker build . -t myapp`;
  await shell`docker push myapp`;
});
```

## Complete Example: build-and-deploy.js Migration

**Original Node.js Script:**
```javascript
#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function buildAndDeploy(env = 'development') {
  console.log(`Building and deploying for ${env}...`);

  // Check if package.json exists
  try {
    await fs.access('package.json');
  } catch {
    console.error('package.json not found');
    process.exit(1);
  }

  // Build
  console.log('Building application...');
  const buildResult = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: env }
  });

  buildResult.on('close', (code) => {
    if (code !== 0) {
      console.error('Build failed');
      process.exit(1);
    }

    console.log('Build successful');

    // Read package.json for version
    fs.readFile('package.json', 'utf8')
      .then(content => {
        const packageJson = JSON.parse(content);
        console.log(`Deploying version ${packageJson.version}...`);

        // Deploy
        const deployCmd = spawn('rsync', [
          '-av', '--delete', 'dist/',
          `user@server:/var/www/${env}/`
        ], { stdio: 'inherit' });

        deployCmd.on('close', (deployCode) => {
          if (deployCode !== 0) {
            console.error('Deployment failed');
            process.exit(1);
          }

          console.log(`Successfully deployed ${packageJson.version} to ${env}`);
        });
      })
      .catch(err => {
        console.error('Failed to read package.json:', err.message);
        process.exit(1);
      });
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const env = args[0] || 'development';

buildAndDeploy(env);
```

**Step 1 - Command Registration:**
```javascript
/**
 * Builds and deploys application
 * @param {string} environment - Target environment (development|staging|production)
 */
export async function buildAndDeploy(environment = 'development') {
  // implementation in Step 2
}
```

**Step 2 - Implementation:**
```javascript
export async function buildAndDeploy(environment = 'development') {
  // Node.js compatibility - stop on failures
  task.stopOnFailures();

  say(`Building and deploying for ${environment}...`);

  // Check if package.json exists
  const packageFile = Bun.file('package.json');
  if (!await packageFile.exists()) {
    yell('package.json not found');
    return;
  }

  // Build
  say('Building application...');
  const buildResult = await shell`
    npm run build
  `.env({ NODE_ENV: environment });

  if (buildResult.hasFailed) {
    yell('Build failed');
    return;
  }

  say('Build successful');

  // Read package.json for version
  const packageJson = await packageFile.json();
  say(`Deploying version ${packageJson.version}...`);

  // Deploy
  const deployResult = await shell`
    rsync -av --delete dist/ user@server:/var/www/${environment}/
  `;

  if (deployResult.hasFailed) {
    yell('Deployment failed');
    return;
  }

  say(`Successfully deployed ${packageJson.version} to ${environment}`);
}
```

**CLI Usage:**
```bash
bunosh build-and-deploy
bunosh build-and-deploy production
bunosh build-and-deploy staging
```

## Package Scripts Integration

**Original package.json:**
```json
{
  "scripts": {
    "build": "node scripts/build.js",
    "deploy": "node scripts/deploy.js production",
    "test": "node scripts/test.js"
  }
}
```

**Migrated to Bunosh:**
```javascript
// Bunoshfile.js
export async function build() {
  await shell`npm run build`;
}

export async function deploy(environment = 'production') {
  await shell`npm run build`;
  await shell`rsync -av dist/ server:/app/`;
}

export async function test() {
  await shell`npm test`;
}
```

**New CLI Usage:**
```bash
bunosh build
bunosh deploy staging
bunosh test
```

## Migration Checklist

- [ ] Register function in Bunoshfile.js with proper parameters
- [ ] Add JSDoc comments for help text
- [ ] Replace `child_process.exec/spawn` with `shell` template literals
- [ ] Replace `console.log` with `say()`
- [ ] Replace `fs` module with Bun.file API
- [ ] Replace `process.env` and `process.chdir()` with shell methods
- [ ] Replace `process.exit()` with early returns
- [ ] Analyze task results instead of try/catch
- [ ] Add `task.stopOnFailures()` for Node.js compatibility
- [ ] Use `task()` wrapper only for grouping complex operations
- [ ] Handle errors with result checks and early returns