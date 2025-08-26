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

## Built-in Functions

All Bunosh functions are available via `global.bunosh`:

```javascript
const { exec, fetch, writeToFile, copyFile, say, ask, yell, task } = global.bunosh;
```

### Shell Execution (`exec`)
```javascript
// Simple commands
await exec`echo "Hello World"`;
await exec`npm install`;

// With environment variables
await exec`echo $NODE_ENV`.env({ NODE_ENV: 'production' });

// With working directory
await exec`ls -la`.cwd('/tmp');

// Complex shell commands
await exec`find . -name "*.js" | grep -v node_modules | wc -l`;
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
```javascript
// Get user input
const name = await ask('What is your name?');

// Output messages
say('Building project...');          // Normal output
yell('BUILD COMPLETE!');             // Emphasized output

// Wrap long operations
await task('Installing dependencies', async () => {
  await exec`npm install`;
});
```

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

### Error Handling
```javascript
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
