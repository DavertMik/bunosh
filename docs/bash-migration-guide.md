# Bash to Bunosh Migration Guide

## Step 1: Command Registration in Bunoshfile.js

All bash scripts must be converted to exported functions in Bunoshfile.js. Each exported function becomes a CLI command.

### Function to Command Mapping

| Function Name | CLI Command | Usage |
|---------------|-------------|-------|
| `updateUsers` | `update-users` | `bunosh update-users` |
| `buildAndDeploy` | `build:and-deploy` | `bunosh build:and-deploy` |
| `gitPush` | `git:push` | `bunosh git:push` |

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
export async function updateUsers(environment, options = {}) {
  const { userId, dryRun = false, force = false } = options;
  // Usage: bunosh update-users production --user-id=123 --dry-run --force
}
```

**JSDoc for Help Text:**
```javascript
/**
 * Updates users in specified environment
 * @param {string} environment - Target environment (dev|staging|prod)
 * @param {object} options
 * @param {string} [options.userId] - Specific user ID to update
 * @param {boolean} [options.dryRun=false] - Perform dry run without making changes
 * @param {boolean} [options.force=false] - Force update even if exists
 */
export async function updateUsers(environment, options = {}) {
  // implementation
}
```

## Step 2: Convert Bash Logic to JavaScript

### Shell Commands

All shell operations go inside `shell`` template literals. Shell is multiline, so combine multiple commands:

```bash
# Bash
echo "Building..."
npm install
npm run build
echo "Done"
```

```javascript
// Bunosh
await shell`
  echo "Building..."
  npm install
  npm run build
  echo "Done"
`;
```

### Shell with Environment and Directory

```javascript
// Set environment variables
await shell`npm run build`.env({ NODE_ENV: 'production' });

// Change working directory
await shell`ls -la`.cwd('/tmp/project');

// Combined usage
await shell`
  npm install
  npm run build
`.env({ NODE_ENV: 'production' }).cwd('/path/to/project');
```

### Control Flow

Convert bash loops/conditionals to JavaScript. Use early returns to avoid nesting:

```bash
# Bash
for file in *.js; do
  if [ -f "$file" ]; then
    echo "Processing $file"
    node "$file"
  else
    echo "File not found: $file"
  fi
done
```

```javascript
// Bunosh - flat structure with early returns
const files = await shell`ls *.js`.stdout.trim().split('\n');
for (const file of files) {
  const fileCheck = await shell`test -f ${file}`;
  if (fileCheck.code !== 0) {
    say(`File not found: ${file}`);
    continue;
  }

  say(`Processing ${file}`);
  await shell`node ${file}`;
}
```

### File Operations

Use Bun.file API for file operations:

```bash
# Bash
cat config.json | jq '.version' > version.txt

# Reading file
content=$(cat config.json)

# Writing file
echo "content" > output.txt

# Checking if file exists
if [ -f "file.txt" ]; then
  echo "File exists"
fi
```

```javascript
// Bunosh - Bun.file API
const configFile = Bun.file('config.json');
const config = await configFile.json();
const version = config.version;

// Write file
await Bun.write('version.txt', version);

// Read file content
const content = await configFile.text();

// Check if file exists
const file = Bun.file('file.txt');
if (await file.exists()) {
  say('File exists');
  return;
}

// Copy file
await Bun.write('destination.txt', Bun.file('source.txt'));
```

### HTTP Requests

Replace curl with fetch():

```bash
# Bash
curl -X POST "https://api.example.com/users" \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'
```

```javascript
// Bunosh
await fetch('https://api.example.com/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});
```

### Output Functions

Replace echo with appropriate functions:

```bash
# Bash
echo "Normal message"
echo "Error message" >&2
```

```javascript
// Bunosh
say('Normal message');
yell('Error message');
```

## Task Results and Error Handling

### Task Result Format

All shell/exec tasks return a TaskResult object:

```javascript
const result = await shell`npm run build`;

// Available properties
console.log(result.status);    // 'success', 'fail', or 'warning'
console.log(result.output);    // Command output or result data
console.log(result.hasFailed); // true if status is 'fail'
console.log(result.hasSucceeded); // true if status is 'success'
console.log(result.hasWarning); // true if status is 'warning'

// Get structured JSON data
const json = await result.json();
```

### Important: Task Behavior Differences from Bash

**Tasks don't throw exceptions** - Analyze results instead of try/catch:

```bash
# Bash - exits on failure by default
npm run build
npm test  # This won't run if build fails
```

```javascript
// Bunosh - tasks continue by default (unlike bash)
const buildResult = await shell`npm run build`;
if (buildResult.hasFailed) {
  yell('Build failed');
  return; // Manual exit required
}

await shell`npm test`; // Only runs if build succeeded
```

**Stop on Failure for Bash Compatibility:**

```javascript
// Make tasks behave like bash (exit on first failure)
task.stopOnFailures();

await shell`npm run build`;  // If this fails, script exits
await shell`npm test`;       // This won't run if build failed
```

**Result Analysis Pattern:**

```javascript
// Don't use try/catch
try {
  await shell`npm run build`;
} catch (error) {
  // This won't work as expected
}

// Instead, analyze results
const result = await shell`npm run build`;
if (result.hasFailed) {
  yell(`Build failed with exit code: ${result.code}`);
  yell(`Error output: ${result.stderr}`);
  return;
}

say('Build successful');
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

// Shell execution with result analysis
const result = await shell`npm run build`;
if (result.hasFailed) {
  yell('Build failed');
  return;
}
say('Build completed');

// Shell with environment and directory
await shell`
  npm install
  npm run build
`.env({ NODE_ENV: 'production' }).cwd('/path/to/project');

// HTTP request with result checking
const response = await fetch('https://api.example.com/data');
if (!response.ok) {
  yell(`HTTP error: ${response.status}`);
  return;
}
const data = await response.json();

// Task grouping with stop on failures
task.stopOnFailures(); // Bash-like behavior

await task('Deploy application', async () => {
  const buildResult = await shell`npm run build`;
  if (buildResult.hasFailed) return;

  const dockerResult = await shell`docker build . -t myapp`;
  if (dockerResult.hasFailed) return;

  await shell`docker push myapp`;
});

// File operations with existence checks
const configFile = Bun.file('config.json');
if (!await configFile.exists()) {
  yell('Config file not found');
  return;
}

const config = await configFile.json();
await Bun.write('backup.json', JSON.stringify(config, null, 2));
say('Config backed up');
```

## Complete Example: update_users.sh Migration

**Original Bash Script:**
```bash
#!/bin/bash
ENV="dev"
DRY_RUN=false
USER_ID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --env) ENV="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --user-id) USER_ID="$2"; shift 2 ;;
  esac
done

echo "Updating users for environment: $ENV"
if [ -n "$USER_ID" ]; then
  response=$(curl -s -w "%{http_code}" -X PUT "http://api.$ENV.example.com/users/$USER_ID" \
    -H "Content-Type: application/json" \
    -d '{"status": "active"}')
  if [ "$response" != "200" ]; then
    echo "Failed to update user $USER_ID"
    exit 1
  fi
else
  users_response=$(curl -s "http://api.$ENV.example.com/users")
  if [ $? -ne 0 ]; then
    echo "Failed to fetch users"
    exit 1
  fi
  echo "$users_response" | jq -r '.[].id' | while read -r user_id; do
    curl -X PUT "http://api.$ENV.example.com/users/$user_id" \
      -H "Content-Type: application/json" \
      -d '{"status": "active"}'
    if [ $? -ne 0 ]; then
      echo "Failed to update user $user_id"
      exit 1
    fi
  done
fi
echo "Update complete"
```

**Step 1 - Command Registration:**
```javascript
/**
 * Updates users in specified environment
 * @param {string} environment - Target environment (dev|staging|prod)
 * @param {object} options
 * @param {string} [options.userId] - Specific user ID to update
 * @param {boolean} [options.dryRun=false] - Perform dry run without making changes
 */
export async function updateUsers(environment, options = {}) {
  // implementation in Step 2
}
```

**Step 2 - Implementation:**
```javascript
export async function updateUsers(environment, options = {}) {
  const { userId = '', dryRun = false } = options;

  // Bash compatibility - stop on failures
  task.stopOnFailures();

  say(`Updating users for environment: ${environment}`);

  if (userId) {
    const result = await task(`Update user ${userId}`, async () => {
      if (dryRun) {
        say(`[DRY RUN] Would update user ${userId}`);
        return { status: 'success' };
      }

      const response = await fetch(`http://api.${environment}.example.com/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' })
      });

      if (!response.ok) {
        yell(`Failed to update user ${userId}: ${response.status}`);
        return { status: 'fail', output: `HTTP ${response.status}` };
      }

      return { status: 'success' };
    });

    if (result.hasFailed) return;
  } else {
    const fetchResult = await task('Fetch all users', async () => {
      const response = await fetch(`http://api.${environment}.example.com/users`);

      if (!response.ok) {
        yell('Failed to fetch users');
        return { status: 'fail', output: `HTTP ${response.status}` };
      }

      const users = await response.json();
      return { status: 'success', output: users };
    });

    if (fetchResult.hasFailed) return;

    const users = fetchResult.output;

    for (const user of users) {
      const updateResult = await task(`Update user ${user.id}`, async () => {
        if (dryRun) {
          say(`[DRY RUN] Would update user ${user.id}`);
          return { status: 'success' };
        }

        const response = await fetch(`http://api.${environment}.example.com/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' })
        });

        if (!response.ok) {
          yell(`Failed to update user ${user.id}: ${response.status}`);
          return { status: 'fail', output: `HTTP ${response.status}` };
        }

        return { status: 'success' };
      });

      if (updateResult.hasFailed) return;
    }
  }

  say('Update complete');
}
```

**CLI Usage:**
```bash
bunosh update-users dev
bunosh update-users prod --user-id=123
bunosh update-users staging --dry-run
```

## Migration Checklist

- [ ] Register function in Bunoshfile.js with proper parameters
- [ ] Add JSDoc comments for help text
- [ ] Convert shell commands to `shell`` template literals
- [ ] Replace bash control flow with JavaScript (use early returns)
- [ ] Use Bun.file API for file operations
- [ ] Replace curl with fetch()
- [ ] Replace echo with say()/yell()
- [ ] Analyze task results instead of try/catch
- [ ] Add `task.stopOnFailures()` for bash compatibility
- [ ] Handle errors with result checks and early returns