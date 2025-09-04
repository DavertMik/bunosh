# 🍲 Bunosh

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="150">
</p>

<p align="center">
  <strong>ONE TOOL TO SCRIPT THEM ALL</strong>
</p>

<p align="center">
  Transform JavaScript functions into powerful CLI commands. Write once, run anywhere.
</p>

---

## What is Bunosh?

Bunosh is a modern task runner that turns your JavaScript functions into CLI commands instantly. No configuration, no boilerplate - just write functions and run them from the terminal.

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients*

### ✨ Key Features

- **🚀 Zero Configuration** - Write functions, get CLI commands automatically
- **🎨 pure JavaScript** - write commands as JavaScript functions
- **📦 Built-in Tasks** - Shell execution, HTTP requests, file operations
- **🤖 AI-Powered** - integrate LLM calls into your daily tasks
- **🔧 Cross-Platform** - Works seamlessly on macOS, Linux, and Windows. Via bun, npm, or as single executable.
- **🎯 Smart CLI** - Auto-completion, help generation, and intuitive argument handling

## Why Choose Bunosh?

### Over Bash Scripts

- **Readable** syntax if you already know JavaScript (no cryptic bash symbol)
- **Cross-platform** without compatibility headaches
- **Rich ecosystem** - use any npm package

### Over npm scripts

- **Real programming** - loops, conditions, async/await
- **Interactive** - outputs, prompts, confirmations, selections
- **Composable** - one file for everything! Call functions from other functions
- **Arguments & options** - full CLI parameter support

### Over Traditional Task Runners

- **No configuration files** - just export functions
- **No DSL to learn** - it's just JavaScript
- **Native speed** - runs on Bun or Node.js
- **Modern DX** - auto-completion, beautiful output

## Table of Contents

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

## Tasks

All Bunosh utilities are available via `global.bunosh`:

```javascript
const { exec, shell, fetch, writeToFile, copyFile, task, ai, say, ask, yell } = global.bunosh;
```

> We use global variables instead of imports to ensure you can use it with bunosh single-executable on any platform.


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
```

For more details see [bun shell](https://bun.sh/docs/runtime/shell) reference

`shell` vs `exec`

| Command | Best For | Use Cases | Implementation | Compatibility |
|---------|----------|-----------|----------------|---------------|
| `exec` | Single command execution | single command | spawn process | NodeJS + Bun but platform dependent |
| `shell` | Multiple cross-platform shell commands | exec + `pwd`, `ls`, `echo`, `cat`, basic file ops | bun shell | Bun only but Cross-platform |

shell prints output from stdout and stderr. To disable output, [make tasks silent](#silent):

### HTTP Requests

Built-in fetch with progress indicators:

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
```

### File Operations

Template-based file writing and copying:

```javascript
/**
 * Generate configuration file
 */
export function generateConfig(name, port = 3000) {
  writeToFile('config.json', (line) => {
    line`{`;
    line`  "name": "${name}",`;
    line`  "port": ${port},`;
    line`  "environment": "development"`;
    line`}`;
  });

  say('📝 Config file created');
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

  const apiHealthy = await task.try(() => fetch('http://localhost:3000/health');

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

  const commit = await ai(
    `Generate a conventional commit message for: ${diff.output}`,
    {
      type: 'Commit type (feat/fix/docs/chore)',
      scope: 'Commit scope (optional)',
      subject: 'Brief subject line (50 chars max)',
      body: 'Detailed explanation'
    }
  );

  const message = commit.scope
    ? `${commit.type}(${commit.scope}): ${commit.subject}\n\n${commit.body}`
    : `${commit.type}: ${commit.subject}\n\n${commit.body}`;

  await exec`git commit -m "${message}"`;
  say('✅ AI-generated commit created');
}
```

See more ai usage examples below:

## Examples

### Development Examples

#### Feature Branch Workflow

```
bunosh worktree:create
bunosh worktree:delete
```

```javascript
/**
 * Create worktree for feature development
 */
export async function worktreeCreate(name = '') {
  const worktreeName = name || await ask('What is feature name?');
  const newDir = `../app-${worktreeName}`;

  await exec`git worktree add ${newDir}`;
  say(`Created worktree for feature ${worktreeName} in ${newDir}`);
}

/**
 * Remove worktree when feature is merged
 */
export async function worktreeDelete(worktree = '') {
  const worktrees = await shell`git worktree list`;
  const worktreePaths = worktrees.output
    .split('\n')
    .map(line => line.split(' ')[0])
    .filter(path => path !== process.cwd());

  if (worktreePaths.length === 0) {
    say('No worktrees found');
    return;
  }

  const worktreeName = worktree || await ask('Select worktree to delete', worktreePaths);
  const rmDir = worktreePaths.find(path => path.includes(worktreeName));

  if (!rmDir) {
    say(`Worktree for feature ${worktreeName} not found`);
    return;
  }

  await exec`git worktree remove ${rmDir} --force`;
  say(`Deleted worktree for feature ${worktreeName} in ${rmDir}`);
}
```

#### Generate Release Notes with AI

```javascript
/**
 * Generate comprehensive release notes using AI
 */
export async function generateReleaseNotes(fromTag = '', toTag = 'HEAD') {
  const { ai, writeToFile, exec, say, ask } = global.bunosh;

  // Get version
  const version = await ask('Release version:', '1.0.0');

  // Get commit history
  const gitLog = fromTag
    ? await exec`git log ${fromTag}..${toTag} --pretty=format:"%h %s" --no-merges`
    : await exec`git log -n 50 --pretty=format:"%h %s" --no-merges`;

  // Get diff statistics
  const stats = fromTag
    ? await exec`git diff --stat ${fromTag}..${toTag}`
    : await exec`git diff --stat HEAD~50..HEAD`;

  // Generate release notes with AI
  const releaseNotes = await ai(
    `Generate professional release notes for version ${version} based on these commits and changes:

    Commits:
    ${gitLog.output}

    Statistics:
    ${stats.output}

    Group changes logically and write user-friendly descriptions.`,
    {
      features: 'New features (bullet points with emoji)',
      fixes: 'Bug fixes',
      acknowledgments: 'Contributors and acknowledgments'
    }
  );

  // Write release notes
  writeToFile(`CHANGELOG.md`, (line) => {
    line`# Release v${version}`;
    line`*${new Date().toLocaleDateString()}*`;
    line``;
    line`## ✨ New Features`;
    line`${releaseNotes.features}`;
    line``;
    line`## 🐛 Bug Fixes`;
    line`${releaseNotes.fixes}`;
    line``;
    line`## 🙏 Acknowledgments`;
    line`${releaseNotes.acknowledgments}`;

    // append previous contents
    line.fromFile('CHANGELOG.md');
  });

  say(`📝 Release notes generated for v${version}`);
}
```

### Analyze Logs with AI

```js
const fileContents = await shell`tail -n 500 error.log`
const analysis = await ai(`Analyze this error log ${fileContents.output}`, {
  severity: "critical/high/medium/low",
  rootCause: "specific issue identified",
  solution: "step-by-step fix",
  preventionTips: "how to avoid this"
});
```

#### Build and Publish Containers in Parallel

```javascript
/**
 * Build and publish multiple services in parallel
 */
export async function publishContainers(registry = 'docker.io/myorg') {
  const { exec, task, say, yell } = global.bunosh;

  const services = ['api', 'web', 'worker', 'admin'];
  const version = process.env.VERSION || 'latest';

  say(`🐳 Building ${services.length} containers...`);

  // Build all containers in parallel
  const buildResults = await Promise.all(
    services.map(service =>
      task(`Building ${service}`, async () => {
        await exec`docker build -t ${registry}/${service}:${version} -f ${service}/Dockerfile ${service}`;
        return service;
      })
    )
  );

  say('✅ All containers built successfully');

  // Push all containers in parallel
  say('📤 Publishing to registry...');

  const pushResults = await Promise.all(
    services.map(service =>
      task(`Publishing ${service}`, async () => {
        await exec`docker push ${registry}/${service}:${version}`;
        return service;
      })
    )
  );

  yell('CONTAINERS PUBLISHED!');
  say(`Published: ${pushResults.join(', ')}`);
  say(`Registry: ${registry}`);
  say(`Version: ${version}`);
}
```

#### Kubernetes Deployment Control

```javascript
/**
 * Deploy to Kubernetes with health checks
 */
export async function kubeDeploy(
  environment = 'staging',
  options = { wait: true, replicas: 3 }
) {
  const { exec, task, say, yell, ask } = global.bunosh;

  // Confirm production deployments
  if (environment === 'production') {
    const confirmed = await ask(
      `⚠️ Deploy to PRODUCTION?`,
      false
    );
    if (!confirmed) {
      say('Deployment cancelled');
      return;
    }
  }

  // Set kubectl context
  await task('Setting context', () =>
    exec`kubectl config use-context ${environment}`
  );

  // Apply configurations
  await task('Applying configurations', () =>
    exec`kubectl apply -f k8s/${environment}/`
  );

  // Scale if needed
  if (options.replicas) {
    await task(`Scaling to ${options.replicas} replicas`, () =>
      exec`kubectl scale deployment/app --replicas=${options.replicas}`
    );
  }

  // Wait for rollout
  if (options.wait) {
    await task('Waiting for rollout', () =>
      exec`kubectl rollout status deployment/app --timeout=5m`
    );
  }

  // Verify deployment
  const pods = await exec`kubectl get pods -l app=myapp -o json`;
  const podData = JSON.parse(pods.output);
  const runningPods = podData.items.filter(
    pod => pod.status.phase === 'Running'
  ).length;

  if (runningPods === options.replicas) {
    yell('DEPLOYMENT SUCCESSFUL!');
    say(`✅ ${runningPods} pods running in ${environment}`);
  } else {
    yell('DEPLOYMENT ISSUES!');
    say(`⚠️ Only ${runningPods}/${options.replicas} pods running`);
  }
}

/**
 * Rollback Kubernetes deployment
 */
export async function kubeRollback(environment = 'staging') {
  const { exec, say, ask } = global.bunosh;

  const confirmed = await ask(
    `Rollback ${environment} deployment?`,
    false
  );

  if (!confirmed) {
    say('Rollback cancelled');
    return;
  }

  await exec`kubectl config use-context ${environment}`;
  await exec`kubectl rollout undo deployment/app`;
  await exec`kubectl rollout status deployment/app`;

  say(`✅ Rolled back ${environment} deployment`);
}
```

#### AWS Infrastructure Management

```
bunosh aws:spawn-server --count 3
```

```javascript
/**
 * Spawn EC2 instances and configure
 *
 */
export async function awsSpawnServer(
  instanceType = 't3.micro',
  options = { count: 1, region: 'us-east-1' }
) {
  const { exec, task, say, writeToFile } = global.bunosh;

  const result = await exec`aws ec2 run-instances \
      --image-id ami-0c55b159cbfafe1f0 \
      --instance-type ${instanceType} \
      --count ${options.count} \
      --region ${options.region} \
      --output json`;

  const instanceIds = JSON.parse(result.output).Instances.map(i => i.InstanceId);
  say(`🚀 Launched instances: ${instanceIds.join(', ')}`);

  exec`aws ec2 wait instance-running --instance-ids ${instanceIds.join(' ')}`

  const details = await exec`aws ec2 describe-instances \
    --instance-ids ${instanceIds.join(' ')} \
    --output json`;
  const instances = JSON.parse(details.output).Reservations[0].Instances;

  writeToFile('instances.json', (line) => {
    line`${JSON.stringify(instances, null, 2)}`;
  });

  // Output connection info
  instances.forEach(instance => {
    say(`Instance ${instance.InstanceId}:`);
    say(`  Public IP: ${instance.PublicIpAddress}`);
    say(`  SSH: ssh -i key.pem ec2-user@${instance.PublicIpAddress}`);
  });

  return instances;
}

/**
 * Configure Cloudflare DNS for new servers
 */
export async function cloudflareSetup(domain, ipAddress) {
  const { exec, task, say } = global.bunosh;

  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  await task('Creating DNS record', async () => {
    const result = await exec`curl -X POST \
      "https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records" \
      -H "Authorization: Bearer ${apiToken}" \
      -H "Content-Type: application/json" \
      --data '{
        "type": "A",
        "name": "${domain}",
        "content": "${ipAddress}",
        "ttl": 3600
      }'`;

    return JSON.parse(result.output);
  });

  say(`✅ DNS configured: ${domain} → ${ipAddress}`);
}


## License

MIT License - see LICENSE file for details.

---

Cooked with ❤️ from Ukraine 🇺🇦
