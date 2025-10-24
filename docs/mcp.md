# MCP Integration

Bunosh supports the **Model Context Protocol (MCP)**, allowing you to expose your Bunoshfile commands as tools for AI assistants like Claude Desktop, Cursor, and other MCP-compatible applications.

## Quick Start

1. **Start MCP server** in your project directory:
```bash
# Uses Bunoshfile.js from current directory
bunosh -mcp

# Or with custom Bunoshfile
bunosh --bunoshfile Bunoshfile.dev.js -mcp
```

2. **Configure your AI assistant** to use Bunosh as an MCP server (see instructions below).

## Claude Desktop Setup

1. **Edit Claude Desktop configuration** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "bunosh": {
      "command": "bunosh",
      "args": ["-mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

2. **Restart Claude Desktop** - your Bunosh commands will now be available as tools.

3. **Use your commands** in Claude:
   - "Build my project with bunosh"
   - "Run tests using bunosh"
   - "Deploy to staging with bunosh"

### Multiple Projects

```json
{
  "mcpServers": {
    "my-app": {
      "command": "bunosh",
      "args": ["-mcp"],
      "cwd": "/path/to/my-app"
    },
    "my-api": {
      "command": "bunosh",
      "args": ["-mcp"],
      "cwd": "/path/to/my-api"
    }
  }
}
```

## Cursor Setup

1. **Open Cursor settings** (`Cmd/Ctrl + ,`)

2. **Navigate to** `Extensions` → `MCP Servers`

3. **Add new MCP server:**
   - **Name**: `bunosh`
   - **Command**: `bunosh`
   - **Arguments**: `-mcp`
   - **Working Directory**: `/path/to/your/project`

4. **Save and restart** Cursor

5. **Your Bunosh commands** will now appear in the AI chat sidebar as available tools.

## Cline Setup (VS Code Extension)

1. **Install Cline** extension from VS Code marketplace

2. **Open Cline settings** (click the gear icon in Cline panel)

3. **Add MCP server** under "MCP Servers" section:
   ```json
   {
     "name": "bunosh",
     "command": "bunosh",
     "args": ["-mcp"],
     "cwd": "/path/to/your/project"
   }
   ```

4. **Save and reload** the VS Code window

5. **Your commands** will be available in Cline's tool selection

## Usage Examples

### Example: Development Workflow

With MCP integration, you can use natural language to execute your Bunosh commands:

```javascript
// In your Bunoshfile.js
export async function build(env = 'production') {
  say(`🔨 Building for ${env}...`);
  await exec`npm run build`.env({ NODE_ENV: env });
  say('✅ Build complete!');
}

export async function test() {
  say('🧪 Running tests...');
  await exec`npm test`;
}

export async function deploy(env = 'staging') {
  say(`🚀 Deploying to ${env}...`);
  await exec`npm run deploy:${env}`;
}
```

**AI Assistant Commands:**
- "Build my project for production"
- "Run all tests"
- "Deploy to staging environment"

### Example: Database Management

```javascript
// Database management commands
export async function migrate() {
  say('🗄️ Running database migrations...');
  await exec`npm run migrate`;
}

export async function seed() {
  say('🌱 Seeding database...');
  await exec`npm run seed`;
}

export async function reset() {
  say('🔄 Resetting database...');
  await exec`npm run db:reset`;
}
```

**AI Assistant Commands:**
- "Run database migrations"
- "Seed the database with sample data"
- "Reset the database"

## Best Practices

1. **Clear command names**: Use descriptive function names that AI can understand
2. **Good documentation**: Add JSDoc comments to explain what each command does
3. **Error handling**: Include proper error handling for robust AI interactions
4. **Feedback**: Use `say()` and `yell()` to provide clear feedback to the user

## Troubleshooting

### MCP Server Not Starting
- Ensure Bunosh is properly installed and accessible
- Check that your Bunoshfile.js exists and is valid
- Verify the working directory path is correct

### Commands Not Showing in AI Assistant
- Restart your AI assistant after configuration
- Check the MCP server logs for errors
- Verify the Bunoshfile contains exported functions

### Permission Issues
- Make sure the AI assistant has access to the project directory
- Check file permissions for the Bunoshfile and related files