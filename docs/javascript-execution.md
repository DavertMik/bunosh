# JavaScript Execution

Bunosh supports executing JavaScript code directly using the `-e` flag, allowing for powerful one-liners and integration with shell scripts and CI/CD systems.

## Basic Usage

```bash
# Execute inline JavaScript
bunosh -e "say('Hello')"

# Execute JavaScript from stdin
echo "say('Hello')" | bunosh -e
```

## Heredoc Syntax

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

## With Environment Variables and Control Flow

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

## Error Handling

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

## JavaScript Execution in GitHub Actions

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

## Shell Integration

```bash
bunosh -e << 'EOF'
say('Running database migrations...')
await shell`npm run migrate`
say('Migrations completed')
EOF
```

## Advanced Examples

### File Processing

```bash
# Process files using JavaScript
bunosh -e << 'EOF'
const files = await shell`find . -name "*.json" | head -5`

for (const file of files.lines) {
  const content = await exec`cat ${file}`
  const data = JSON.parse(content.output)

  say(`📄 Processing ${file}: ${data.name || 'unnamed'}`)

  // Update file
  data.processed = new Date().toISOString()
  writeToFile(file, JSON.stringify(data, null, 2))
}

say('✅ Files processed')
EOF
```

### API Calls and Data Processing

```bash
# Fetch and process API data
bunosh -e << 'EOF'
const response = await fetch('https://api.github.com/repos/davertmik/bunosh')
const repo = await response.json()

say(`📦 Repository: ${repo.name}`)
say(`⭐ Stars: ${repo.stargazers_count}`)
say(`🍴 Forks: ${repo.forks_count}`)
say(`📝 Description: ${repo.description}`)

if (repo.stargazers_count > 100) {
  yell('🎉 Popular repository!')
}
EOF
```

### Database Operations

```bash
# Database cleanup script
bunosh -e << 'EOF'
const dbName = process.env.DB_NAME || 'app_db'
say(`🗄️ Cleaning database: ${dbName}`)

await task('Backup database', () => shell`pg_dump ${dbName} > backup.sql`)
await task('Remove old records', () => shell`psql ${dbName} -c "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days';"`)
await task('Vacuum', () => shell`psql ${dbName} -c "VACUUM ANALYZE;"`)

say('✅ Database cleanup completed')
EOF
```

## Tips and Best Practices

1. **Use Heredoc for Multi-line Scripts** - Much more readable than long one-liners
2. **Environment Variables** - Access via `process.env` for configuration
3. **Error Handling** - Use `task.stopOnFailures()` and try/catch blocks
4. **CI/CD Integration** - Perfect for GitHub Actions, GitLab CI, etc.
5. **One-liners** - Great for quick tasks and shell integration