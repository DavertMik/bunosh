# 🍲 Bunosh

> *Named after **banosh**, a traditional Ukrainian dish from cornmeal cooked with various ingredients such as mushrooms, cheese, sour cream*

<p align="center">
  <img src="assets/logo.png" alt="Logo" width="150">
</p>

## What is Bunosh?

Bunosh is a modern task runner that transforms JavaScript functions into CLI commands. Write your build, deploy, and automation tasks in JavaScript and run them directly from the command line.

**Why Bunosh?**
- ✨ **Zero Configuration**: Write functions, get CLI commands
- 🚀 **Fast Execution**: Built for speed with beautiful terminal output
- 🎨 **Rich Output**: Colored formatting with progress indicators
- 📦 **Built-in Tasks**: Shell execution, HTTP requests, file operations
- 🔧 **Cross-Platform**: Works on macOS, Linux, and Windows

## Installation

### Option 1: Single Executable (Recommended)

Download and install the standalone executable - no Node.js or Bun required. Includes built-in upgrade functionality:

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
# Add bunosh.exe to your PATH
```

### Option 2: Bun Package Manager

```bash
bun add -g bunosh
```

### Option 3: NPM Package

```bash
npm install -g bunosh
```


```bash
# Initialize a new Bunoshfile
bunosh init

# This creates Bunoshfile.js with sample tasks
```

### Example: Web Development Tasks

Create a `Bunoshfile.js`:

```javascript
// Import Bunosh functions from global object
const { exec, fetch, writeToFile, say, ask, yell } = global.bunosh;

/**
 * Installs project dependencies
 */
export async function install() {
  await exec`npm install`;
  say('📦 Dependencies installed!');
}

/**
 * Starts development server
 */
export async function dev() {
  say('🚀 Starting development server...');
  await exec`npm run dev`;
}

/**
 * Builds project for production
 */
export async function build(target = 'production') {
  say(`🔨 Building for ${target}...`);
  await exec`npm run build`;

  if (target === 'production') {
    await exec`npm run optimize`;
    yell('BUILD COMPLETE!');
  }
}

/**
 * Deploys to specified environment
 */
export async function deploy(env = 'staging', options = { skipTests: false }) {
  if (!options.skipTests) {
    say('🧪 Running tests...');
    await exec`npm test`;
  }

  say(`🚀 Deploying to ${env}...`);
  await build('production');
  await exec`docker build -t myapp:${env} .`;
  await exec`docker push myapp:${env}`;

  yell(`DEPLOYED TO ${env.toUpperCase()}!`);
}

/**
 * Cleans up temporary files
 */
export async function clean() {
  await exec`rm -rf dist node_modules/.cache tmp`;
  say('✨ All clean!');
}

/**
 * Setup new project environment
 */
export async function setup() {
  const projectName = await ask('What is your project name?');
  const useTypescript = await ask('Use TypeScript? (y/n)') === 'y';

  say('🏗️ Setting up project...');

  // Create package.json
  writeToFile('package.json', (line) => {
    line`{`;
    line`  "name": "${projectName}",`;
    line`  "version": "1.0.0",`;
    line`  "type": "module"`;
    if (useTypescript) {
      line`,  "devDependencies": {`;
      line`    "typescript": "^5.0.0"`;
      line`  }`;
    }
    line`}`;
  });

  if (useTypescript) {
    await exec`npm install typescript --save-dev`;
  }

  yell('PROJECT READY!');
}
```

### Run Your Tasks

```bash
# List all available commands
bunosh

# Run individual tasks
bunosh install
bunosh dev
bunosh build
bunosh build staging
bunosh deploy production --skip-tests
bunosh clean
bunosh setup
```

**Bunosh will display your tasks like this:**

```
🍲 Your exceptional task runner

Usage: bunosh <command> <args> [options]

  Commands are loaded from exported functions in Bunoshfile.js

Commands:
  build                 Builds project for production
                          bunosh build [target]
  clean                 Cleans up temporary files
  deploy                Deploys to specified environment
                          bunosh deploy [env] --skip-tests
  dev                   Starts development server
  install               Installs project dependencies
  setup                 Setup new project environment
```

## Example: DevOps Tasks

```javascript
const { exec, fetch, writeToFile, say, task } = global.bunosh;

/**
 * Checks service health across environments
 */
export async function healthCheck(env = 'production') {
  const services = ['api', 'web', 'database'];

  for (const service of services) {
    const url = `https://${service}.${env}.example.com/health`;
    await task(`Checking ${service}`, async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${service} is down!`);
    });
  }

  say('✅ All services healthy!');
}

/**
 * Backup database with compression
 */
export async function backup(database = 'main') {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `backup-${database}-${timestamp}.sql.gz`;

  await exec`pg_dump ${database} | gzip > ${filename}`;
  await exec`aws s3 cp ${filename} s3://backups/${filename}`;
  await exec`rm ${filename}`;

  say(`📦 Backup saved: ${filename}`);
}

/**
 * Updates SSL certificates
 */
export async function updateCerts() {
  await exec`certbot renew`;
  await exec`nginx -s reload`;
  say('🔒 Certificates updated!');
}

/**
 * Deploys application with health checks
 */
export async function deployWithChecks(env = 'staging') {
  await exec`kubectl apply -f k8s/${env}/`;
  await exec`kubectl rollout status deployment/myapp`;
  await healthCheck(env);
  say(`🚀 Successfully deployed to ${env}!`);
}

/**
 * Scales application instances
 */
export async function scale(replicas = 3, service = 'myapp') {
  await exec`kubectl scale deployment/${service} --replicas=${replicas}`;
  say(`⚖️ Scaled ${service} to ${replicas} replicas`);
}
```

**Bunosh displays these as:**

```
Usage: bunosh <command> <args> [options]

  Commands are loaded from exported functions in Bunoshfile.js

Commands:
  backup                Backup database with compression
                          bunosh backup [database]
  deploy:with-checks    Deploys application with health checks
                          bunosh deploy:with-checks [env]
  health:check          Checks service health across environments
                          bunosh health:check [env]
  scale                 Scales application instances
                          bunosh scale [replicas] [service]
  update:certs          Updates SSL certificates

```

## Example: Content Management

```javascript
const { exec, writeToFile, ask, say } = global.bunosh;

/**
 * Creates new blog post template
 */
export async function newPost() {
  const title = await ask('Post title:');
  const slug = title.toLowerCase().replace(/\s+/g, '-');
  const date = new Date().toISOString().split('T')[0];

  writeToFile(`posts/${date}-${slug}.md`, (line) => {
    line`---`;
    line`title: "${title}"`;
    line`date: ${date}`;
    line`draft: true`;
    line`---`;
    line``;
    line`# ${title}`;
    line``;
    line`Your content here...`;
  });

  say(`📝 Created: posts/${date}-${slug}.md`);
}

/**
 * Optimizes and compresses images
 */
export async function optimizeImages() {
  await exec`find ./images -name "*.jpg" -exec jpegoptim --max=80 {} \\;`;
  await exec`find ./images -name "*.png" -exec optipng -o2 {} \\;`;
  say('🖼️ Images optimized!');
}

/**
 * Creates new page template
 */
export async function newPage(name) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');

  writeToFile(`content/pages/${slug}.md`, (line) => {
    line`---`;
    line`title: "${name}"`;
    line`type: "page"`;
    line`---`;
    line``;
    line`# ${name}`;
    line``;
    line`Page content here...`;
  });

  say(`📄 Created: content/pages/${slug}.md`);
}

/**
 * Generates site and deploys
 */
export async function publish() {
  await exec`hugo --minify`;
  await exec`rsync -avz public/ user@server:/var/www/site/`;
  say('🌐 Site published!');
}

/**
 * Builds and serves development site
 */
export async function serve(port = 1313) {
  await exec`hugo server --port ${port} --buildDrafts`;
}
```

**Bunosh displays these as:**

```
Usage: bunosh <command> <args> [options]

  Commands are loaded from exported functions in Bunoshfile.js

Commands:
  new:page              Creates new page template
                          bunosh new:page <name>
  new:post              Creates new blog post template
  optimize:images       Optimizes and compresses images
  publish               Generates site and deploys
  serve                 Builds and serves development site
                          bunosh serve [port]

```

### Error Handling

Bunosh provides flexible error handling to suit different scenarios:

```javascript
// Option 1: Try operations that might fail
export async function checkConnection() {
  const success = await task.try('Database connection', () => {
    return shell`nc -z db 5432`;
  });

  if (success) {
    say('✅ Database is reachable');
  } else {
    say('⚠️ Database unreachable, using fallback');
    await useFallbackDatabase();
  }
}

// Option 2: Continue on failures
export async function cleanup() {
  task.ignoreFailures();  // Don't exit if cleanup fails

  await task('Remove temp files', () => shell`rm -rf tmp/*`);
  await task('Clear logs', () => shell`rm -f logs/*.log`);
  // Script continues even if some operations fail
}

// Option 3: Stop immediately on failure
export async function deploy() {
  task.stopOnFailures();  // Exit immediately if any task fails

  await task('Run tests', () => shell`npm test`);
  await task('Build', () => shell`npm run build`);
  await task('Deploy', () => shell`deploy-script`);
  // If any task fails, script exits immediately
}

// Option 4: Traditional try/catch for critical operations
export async function deployWithRollback(env) {
  try {
    await deploy(env);
  } catch (error) {
    say('❌ Deployment failed, rolling back...');
    await exec`kubectl rollout undo deployment/myapp`;
    throw error;
  }
}
```

### Output Control

Control when tasks print to the console - perfect for background operations, CI/CD pipelines, or reducing noise.

```javascript
// Globally disable all task output
task.silence();
await task('Background cleanup', () => shell`rm -rf temp-files`);

// Restore output printing
task.prints();

// Execute specific tasks silently
await task.silent().task('Silent operation', () => {
  // This task won't print any output
  doSomethingQuietly();
});

// Silent try operations
const success = await task.silent().try('Risky operation', () => {
  return attemptSomethingRisky();
});
```

**Use cases:**
- CI/CD pipelines with noisy tasks
- Background cleanup operations
- Reducing output noise in automated workflows
- Running optional checks without cluttering output

### Handle Task Failures

Choose how your script behaves when tasks fail - stop immediately or continue and handle failures gracefully.

```javascript
// Stop immediately on any failure (strict mode)
task.stopOnFailures();
await task('Deploy', () => shell`deploy-script`);
// If deploy fails, script exits immediately

// Continue on failures (permissive mode)
task.ignoreFailures();
await task('Optional checks', () => shell`might-fail-command`);
// Script continues even if checks fail

// Try operations that might fail
const success = await task.try('Test connection', () => {
  return shell`nc -z localhost 3000`;
});

if (success) {
  say('✅ Connection successful');
} else {
  say('⚠️ Connection failed, but continuing...');
}
```

**Failure behaviors:**
- **Default**: Continue running, show error, exit with code 1 at end
- **`stopOnFailures()`**: Exit immediately with code 1 on any failure
- **`ignoreFailures()`**: Continue running, exit with code 0 regardless of failures
- **`task.try()`**: Returns true/false, never exits, logs as warning

## Tasks

All Bunosh tasks are available via `global.bunosh`:

```javascript
const { exec, shell, fetch, writeToFile, copyFile, task } = global.bunosh;
```

### Shell Execution

Bunosh provides two ways to execute shell commands:

#### `exec` - Universal Shell Execution

Best for complex commands, cross-platform compatibility, and when you need real-time streaming output.

```javascript
// Complex shell commands with pipes and redirections
await exec`find . -name "*.js" | grep -v node_modules | wc -l`;
await exec`npm install --verbose`;  // Shows progress in real-time
await exec`docker build . | tee build.log`;
```

#### `shell` - Native Bun Shell (with Node.js fallback)

Best for simple commands when running under Bun for maximum performance.

```javascript
// Simple, fast commands
await shell`pwd`;
await shell`echo "Hello World"`;
await shell`ls -la`;
await shell`cat package.json`;
```

Comparison: `shell` vs `exec`

| Command | Best For | Use Cases |
|---------|----------|-----------|
| `shell` | Simple, fast commands under Bun | `pwd`, `ls`, `echo`, `cat`, basic file ops |
| `exec` | Complex, cross-platform commands | Pipes, redirections, streaming output, package managers |

Both support the same API and return the same `TaskResult` object:

```javascript
// Both tasks support environment variables
await shell`echo $NODE_ENV`.env({ NODE_ENV: 'production' });
await exec`echo $NODE_ENV`.env({ NODE_ENV: 'production' });

// Both support working directory changes
await shell`pwd`.cwd('/tmp');
await exec`ls -la`.cwd('/tmp');

// Choose based on complexity and performance needs
await shell`cat package.json`;              // Simple, fast
await exec`npm install --verbose`;          // Complex, streaming
```

#### TaskResult Object

Both `exec` and `shell` return a `TaskResult` object with the following properties and methods:

```javascript
const result = await exec`ls -la`;
// or
const result = await shell`ls -la`;

// Properties
result.status   // 'success' or 'fail'
result.output   // Combined stdout/stderr as string

// Getters (boolean)
result.hasFailed     // true if command failed (non-zero exit code)
result.hasSucceeded  // true if command succeeded (exit code 0)
```

#### Error Handling Examples

```javascript
// Check command success
const result = await exec`npm test`;
if (result.hasSucceeded) {
  say('✅ Tests passed!');
} else {
  yell('❌ Tests failed!');
  console.log(result.output); // Show error details
}

// Get command output
const result = await exec`git rev-parse HEAD`;
if (result.hasSucceeded) {
  const commitHash = result.output.trim();
  say(`Current commit: ${commitHash}`);
}

// Handle failures gracefully
const result = await exec`optional-command-that-might-fail`;
if (result.hasFailed) {
  say('Command failed, but continuing...');
  console.log('Error output:', result.output);
}

// Old vs New style comparison
// ❌ Old: Commands throw on failure
try {
  await someOtherTaskRunner('failing-command');
} catch (error) {
  // Handle error
}

// ✅ New: Explicit success/failure handling
const result = await exec`failing-command`;
if (result.hasFailed) {
  // Handle failure explicitly
}
```

### HTTP Requests (`fetch`)
```javascript
// GET request with progress indicator
const response = await fetch('https://api.github.com/repos/user/repo');
const data = await response.json();
```

### File Operations
```javascript
// Write file with template builder
writeToFile('config.json', (line) => {
  line`{`;
  line`  "name": "myapp",`;
  line`  "version": "1.0.0"`;
  line`}`;
});

// Copy files
copyFile('template.js', 'output.js');
```

### User Interaction

#### `ask()` - Interactive User Input

The `ask()` function provides flexible ways to get user input with smart parameter detection and multiple modes:

```javascript
// === SIMPLE SYNTAX WITH SMART DETECTION ===

// Basic text input
const name = await ask('What is your name?');

// Text input with default value
const projectName = await ask('Project name:', 'my-awesome-app');

// Boolean confirmation (auto-detects confirm type)
const shouldContinue = await ask('Continue with deployment?', true);
const forceUpdate = await ask('Force update?', false);

// Number input with default
const port = await ask('Enter port number:', 3000);

// Single choice selection (auto-detects from array)
const framework = await ask('Choose your framework:', [
  'React', 'Vue', 'Angular', 'Svelte'
]);

// Multiple choice selection (array + options)
const features = await ask('Select features to include:', [
  'TypeScript', 'ESLint', 'Prettier', 'Tests', 'CI/CD'
], { multiple: true });

// === ADVANCED OPTIONS SYNTAX ===

// Multiline text input (opens system editor)
const description = await ask('Enter project description:', {
  multiline: true  // Same as editor: true
});

// Editor input with default content
const config = await ask('Edit configuration:', {
  editor: true,
  default: 'Initial content here...'
});

// Password input (hidden)
const password = await ask('Enter password:', {
  type: 'password'
});

// Mixed: default value + additional options
const email = await ask('Email address:', 'user@example.com', {
  validate: (input) => input.includes('@') || 'Please enter valid email'
});
```

#### Ask Function Signatures

```javascript
// Smart detection syntax
ask(question, defaultValue, options?)
ask(question, choices[], options?)
ask(question, options)

// Examples:
ask('Name?', 'John')                    // String default
ask('Continue?', true)                  // Boolean -> confirm type
ask('Port?', 3000)                      // Number default
ask('Color?', ['red', 'blue'])          // Array -> choices
ask('Colors?', ['red', 'blue'], { multiple: true })  // Array + options
```

#### Ask Options Reference

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

#### Advanced Ask Examples

```javascript
/**
 * Interactive project setup with smart syntax
 */
export async function setupProject() {
  // Simple syntax with smart detection
  const projectName = await ask('Project name:', 'my-awesome-project');

  const projectType = await ask('Project type:', [
    'Web App', 'API', 'CLI Tool', 'Library'
  ]);

  const dependencies = await ask('Select dependencies:', [
    'express', 'lodash', 'axios', 'moment', 'uuid'
  ], { multiple: true });

  const useTypescript = await ask('Use TypeScript?', false);

  // Editor input for complex configuration
  const packageJson = await ask('Customize package.json:', {
    editor: true,
    default: JSON.stringify({
      name: projectName,
      version: '1.0.0',
      description: '',
      dependencies: {}
    }, null, 2)
  });

  say(`Creating ${projectType}: ${projectName}`);
  say(`Dependencies: ${dependencies.join(', ')}`);
  say(`TypeScript: ${useTypescript ? 'Yes' : 'No'}`);

  writeToFile('package.json', packageJson);
}

/**
 * Git commit with editor input
 */
export async function interactiveCommit() {
  const message = await ask('Enter commit message:', {
    editor: true,
    default: 'feat: \n\n# Write your commit message above\n# First line: brief summary (50 chars max)\n# Blank line, then detailed explanation'
  });

  await exec`git commit -m "${message}"`;
  say('✅ Committed successfully!');
}

/**
 * Database migration with smart syntax
 */
export async function migrate() {
  // Smart array detection for choices
  const action = await ask('Migration action:', [
    'Run pending migrations',
    'Rollback last migration',
    'Reset database',
    'Create new migration'
  ]);

  if (action === 'Reset database') {
    // Smart boolean detection for confirmation
    const confirmed = await ask('⚠️  This will DELETE ALL DATA. Are you sure?', false);

    if (!confirmed) {
      say('Migration cancelled');
      return;
    }
  }

  // Execute migration based on selection...
}

/**
 * Server configuration with mixed smart syntax
 */
export async function configureServer() {
  // Simple defaults
  const serverName = await ask('Server name:', 'my-server');
  const port = await ask('Port number:', 8080);
  const enableHTTPS = await ask('Enable HTTPS?', true);

  // Array with additional options
  const databases = await ask('Select databases to connect:', [
    'PostgreSQL', 'MongoDB', 'Redis', 'MySQL'
  ], { multiple: true });

  // Mix of default + validation
  const adminEmail = await ask('Admin email:', 'admin@example.com', {
    validate: (email) => email.includes('@') || 'Please enter a valid email'
  });

  say(`Configuring ${serverName} on port ${port}`);
  say(`HTTPS: ${enableHTTPS ? 'Enabled' : 'Disabled'}`);
  say(`Databases: ${databases.join(', ')}`);
  say(`Admin: ${adminEmail}`);
}
```

#### Output Functions

```javascript
// Simple output messages
say('Building project...');          // Normal output with !
yell('BUILD COMPLETE!');             // Emphasized ASCII art output

// Wrap operations with progress tracking
await task('Installing dependencies', async () => {
  await exec`npm install`;
});
```

## 🤖 AI-Powered Tasks

Bunosh now supports AI integration with structured outputs! Connect to popular AI providers and generate content, analyze data, or automate text processing with simple function calls.

### Quick Setup

Set your AI provider credentials:
```bash
# Required: Choose your model
export AI_MODEL=gpt-4o                         # or claude-3-5-sonnet-20241022, llama-3.3-70b-versatile, etc.

# Required: Set API key for your chosen provider
export OPENAI_API_KEY=your_key_here           # for OpenAI models
# export ANTHROPIC_API_KEY=your_key_here       # for Claude models
# export GROQ_API_KEY=your_key_here            # for Groq models
```

### Built-in AI Providers

- **OpenAI** - GPT-4o, GPT-4o-mini, GPT-3.5-turbo (via `OPENAI_API_KEY`)
- **Anthropic** - Claude 3.5 Sonnet, Claude 3 Haiku (via `ANTHROPIC_API_KEY`)
- **Groq** - Llama 3.3, Mixtral, Gemma models (via `GROQ_API_KEY` or `GROQ_KEY`)

### Custom AI Providers

For enterprise and custom setups, you can import and register any AI provider manually:

```javascript
const { ai } = global.bunosh;

// Method 1: Direct model configuration (most flexible)
import { bedrock } from '@ai-sdk/amazon-bedrock';
const bedrockModel = bedrock('anthropic.claude-3-sonnet-20240229-v1:0', {
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'your-access-key',
    secretAccessKey: 'your-secret-key'
  }
});

ai.configure({ model: bedrockModel });

// Method 2: Register custom provider with environment variable
import { xai } from '@ai-sdk/xai';
ai.configure({
  registerProvider: {
    envVar: 'XAI_API_KEY',
    provider: {
      createInstance: (modelName) => xai(modelName)
    }
  }
});

// Method 3: Register any custom provider (Azure OpenAI, OpenRouter, etc.)
import { openrouter } from '@openrouter/ai-sdk-provider';
ai.configure({
  registerProvider: {
    envVar: 'OPENROUTER_API_KEY',
    provider: {
      createInstance: (modelName) => openrouter(modelName)
    }
  }
});

// Method 4: Register completely custom provider
ai.configure({
  registerProvider: {
    envVar: 'CUSTOM_AI_API_KEY',
    provider: {
      createInstance: (modelName) => {
        // Your custom provider logic
        return customAIProvider(modelName, {
          apiKey: process.env.CUSTOM_AI_API_KEY,
          endpoint: 'https://custom-ai.company.com/v1'
        });
      }
    }
  }
});

// Reset to environment variable configuration
ai.reset();

// Check current configuration
const config = ai.getConfig();
console.log('Current AI config:', config);
```

### AI Task Examples

```javascript
const { ai, writeToFile, say } = global.bunosh;

/**
 * Generate project documentation with AI
 */
export async function generateDocs() {
  const codebase = fs.readFileSync('src/index.js', 'utf8');

  const result = await ai(
    `Generate documentation for this code: ${codebase}`,
    {
      overview: 'Brief project overview',
      apiReference: 'API documentation',
      examples: 'Usage examples',
      installation: 'Installation instructions'
    }
  );

  writeToFile('README.md', (line) => {
    line`# ${result.overview}`;
    line``;
    line`## Installation`;
    line`${result.installation}`;
    line``;
    line`## API Reference`;
    line`${result.apiReference}`;
    line``;
    line`## Examples`;
    line`${result.examples}`;
  });

  say('📚 Documentation generated!');
}

/**
 * Analyze and optimize code with AI suggestions
 */
export async function codeReview(filename) {
  const code = fs.readFileSync(filename, 'utf8');

  const analysis = await ai(
    `Review this code for improvements: ${code}`,
    {
      issues: 'List of potential issues',
      suggestions: 'Specific improvement suggestions',
      security: 'Security considerations',
      performance: 'Performance optimization tips',
      rating: 'Overall code quality rating (1-10)'
    }
  );

  say(`🔍 Code Review for ${filename}:`);
  console.log(`Rating: ${analysis.rating}/10`);
  console.log(`Issues: ${analysis.issues}`);
  console.log(`Suggestions: ${analysis.suggestions}`);
  console.log(`Security: ${analysis.security}`);
  console.log(`Performance: ${analysis.performance}`);
}

/**
 * Generate test cases from code
 */
export async function generateTests(sourceFile) {
  const code = fs.readFileSync(sourceFile, 'utf8');

  const tests = await ai(
    `Generate comprehensive unit tests for this code: ${code}`,
    {
      testSuite: 'Complete test suite code',
      edgeCases: 'List of edge cases covered',
      mockSetup: 'Required mocks and setup code'
    }
  );

  const testFile = sourceFile.replace('.js', '.test.js');
  writeToFile(testFile, (line) => {
    line`${tests.mockSetup}`;
    line``;
    line`${tests.testSuite}`;
  });

  say(`🧪 Tests generated: ${testFile}`);
  say(`Edge cases: ${tests.edgeCases}`);
}

/**
 * Create commit messages from git diff
 */
export async function smartCommit() {
  const diff = await exec`git diff --staged`;

  if (diff.hasFailed || !diff.output.trim()) {
    say('No staged changes found');
    return;
  }

  const commit = await ai(
    `Generate a commit message for these changes: ${diff.output}`,
    {
      title: 'Concise commit title (50 chars max)',
      body: 'Detailed commit body explaining what and why',
      type: 'Commit type (feat/fix/docs/refactor/test/chore)'
    }
  );

  const message = `${commit.type}: ${commit.title}\n\n${commit.body}`;
  await exec`git commit -m "${message}"`;

  say(`✅ Committed with AI-generated message:`);
  console.log(message);
}

/**
 * Enterprise AI setup with custom provider
 */
export async function setupEnterpriseAI() {
  // Import your enterprise AI provider
  import { bedrock } from '@ai-sdk/amazon-bedrock';

  // Configure for enterprise use
  const enterpriseModel = bedrock('anthropic.claude-3-sonnet-20240229-v1:0', {
    region: 'us-east-1'
    // Uses AWS credentials from environment/profile
  });

  ai.configure({ model: enterpriseModel });

  const analysis = await ai(
    'Analyze our company performance from this quarterly report: [data]',
    {
      summary: 'Executive summary of performance',
      risks: 'Identified business risks',
      opportunities: 'Growth opportunities',
      recommendations: 'Strategic recommendations'
    }
  );

  say('📊 Enterprise AI analysis complete');
  console.log(analysis);
}
```

### Simple Text Generation

For quick text generation without structured output:

```javascript
/**
 * Generate marketing copy
 */
export async function generateCopy(product) {
  const copy = await ai(`Write compelling marketing copy for: ${product}`);
  say('📝 Generated copy:');
  console.log(copy);
}

/**
 * Translate content
 */
export async function translate(text, language = 'Spanish') {
  const translation = await ai(`Translate to ${language}: ${text}`);
  say(`🌐 Translation to ${language}:`);
  console.log(translation);
}
```

### Progressive Enhancement

The AI task features:
- **🎭 Animated Progress**: Braille spinner animation during generation
- **📊 Token Tracking**: Shows token usage for cost monitoring
- **⚡ Fast Inference**: Optimized for speed with Groq and other providers
- **🔧 Structured Output**: Get JSON responses with defined schemas
- **🎯 Provider Auto-Detection**: Automatically detects available API keys
- **💪 Error Handling**: Graceful handling of API errors and rate limits

Transform your development workflow with AI-powered automation! Generate documentation, analyze code, create tests, write commit messages, and much more.

## Command Features

### Automatic CLI Generation
- `functionName` → `bunosh function:name`
- Function parameters become command arguments
- Last object parameter becomes CLI options
- JSDoc comments become help descriptions

### Smart Argument Handling
```javascript
// Function definition
export function deploy(env = 'staging', options = { force: false, verbose: false }) {
  // ...
}

// CLI usage
bunosh deploy production --force --verbose
```

### Help and Documentation
```bash
# List all commands
bunosh

# Get help for specific command
bunosh deploy --help
```

### Shell Auto-Completion
Enable tab completion for faster command typing:

```bash
# 🚀 Auto-setup (recommended) - detects your shell and installs completion
bunosh setup-completion

# Manual setup if needed
bunosh completion bash > ~/.bunosh-completion.bash
echo "source ~/.bunosh-completion.bash" >> ~/.bashrc
source ~/.bashrc

# Now use tab completion
bunosh dep<TAB>    # Completes to 'deploy'
bunosh <TAB><TAB>  # Shows all available commands
```

**Supported shells:** bash, zsh, fish. The `setup-completion` command automatically detects your shell and handles installation. See [COMPLETION.md](COMPLETION.md) for detailed setup.

### Staying Up to Date

**Single Executable:**
```bash
# Check for updates
bunosh upgrade --check

# Upgrade to latest version
bunosh upgrade

# Force reinstall current version
bunosh upgrade --force
```

**NPM Installation:**
```bash
npm update -g bunosh
```

## Advanced Usage

### Parallel Task Execution
```javascript
const results = await Promise.all([
  task('Task 1', () => exec`sleep 2 && echo "Done 1"`),
  task('Task 2', () => exec`sleep 2 && echo "Done 2"`),
  task('Task 3', () => exec`sleep 2 && echo "Done 3"`)
]);
```



### NPM Scripts Integration
Bunosh automatically includes your package.json scripts:
```bash
bunosh npm:test    # runs npm run test
bunosh npm:build   # runs npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for modern JavaScript development
