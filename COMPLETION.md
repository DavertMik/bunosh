# Shell Completion for Bunosh

Bunosh supports auto-completion for bash, zsh, and fish shells. This allows you to:

- **Tab-complete** command names
- **Auto-suggest** available tasks from your Bunoshfile.js
- **Complete** special commands like `init`, `completion`, `edit`

## Installation

### 🚀 Auto-Setup (Recommended)

The easiest way to enable completion:

```bash
bunosh setup-completion
```

This command will:
- **Auto-detect your shell** (bash, zsh, or fish)
- **Generate the completion script** for your shell
- **Install it in the correct location**
- **Update your shell config** (for bash/zsh)
- **Provide next steps** for activation

**Example output for Fish:**
```bash
$ bunosh setup-completion
🐚 Detected shell: fish

🔧 Installing completion...
✅ Completion installed: /home/user/.config/fish/completions/bunosh.fish
🐟 Fish completion is ready! No restart needed.

🎯 Test completion by typing: bunosh <TAB>
```

**Example output for Bash:**
```bash
$ bunosh setup-completion
🐚 Detected shell: bash

🔧 Installing completion...
✅ Completion installed: /home/user/.bunosh-completion.bash
📝 Updated shell config: /home/user/.bashrc

💡 Restart your terminal or run:
   source ~/.bashrc

🎯 Test completion by typing: bunosh <TAB>
```

**Options:**
```bash
# Force reinstall (overwrite existing)
bunosh setup-completion --force

# Specify shell manually
bunosh setup-completion --shell fish
bunosh setup-completion --shell bash
bunosh setup-completion --shell zsh
```

### Manual Setup

If you prefer manual setup, generate the completion script for your shell:

```bash
# For Bash
bunosh completion bash > ~/.bunosh-completion.bash

# For Zsh
bunosh completion zsh > ~/.bunosh-completion.zsh

# For Fish
bunosh completion fish > ~/.config/fish/completions/bunosh.fish
```

### 2. Enable Completion

#### Bash

Add to your `~/.bashrc` or `~/.bash_profile`:

```bash
# Load bunosh completion
if [ -f ~/.bunosh-completion.bash ]; then
    source ~/.bunosh-completion.bash
fi
```

Then reload your shell:
```bash
source ~/.bashrc
```

#### Zsh

Add to your `~/.zshrc`:

```zsh
# Load bunosh completion
if [ -f ~/.bunosh-completion.zsh ]; then
    source ~/.bunosh-completion.zsh
fi
```

Then reload your shell:
```bash
source ~/.zshrc
```

#### Fish

Fish will automatically load completions from `~/.config/fish/completions/`. No additional setup required after copying the file.

## Usage

Once installed, you can use tab completion:

```bash
# Tab complete commands
bunosh <TAB>
# Shows: build, deploy, test, clean, etc.

# Tab complete specific commands
bunosh dep<TAB>
# Completes to: deploy

# Tab complete completion command
bunosh completion <TAB>
# Shows: bash zsh fish

# Tab complete special commands
bunosh <TAB>
# Shows all commands including: init, edit, export:scripts, completion
```

## How It Works

Bunosh completion works by:

1. **Parsing your Bunoshfile.js** to extract exported function names
2. **Converting function names** to command format (camelCase → kebab:case)
3. **Reading JSDoc comments** for command descriptions
4. **Generating shell-specific** completion scripts

## Examples

With a Bunoshfile.js like:

```javascript
/**
 * Builds the project
 */
export function build() { /* ... */ }

/**
 * Deploys to environment
 */
export function deployToStaging() { /* ... */ }
```

You get completion for:
- `build` - Builds the project
- `deploy:to-staging` - Deploys to environment

## Updating Completions

When you add new tasks to your Bunoshfile.js, regenerate the completion script:

```bash
bunosh completion bash > ~/.bunosh-completion.bash
source ~/.bashrc
```

## Troubleshooting

### Completion Not Working

1. **Check shell**: Make sure you're using a supported shell (bash, zsh, fish)
2. **Verify script**: Run `bunosh completion bash` to see if it generates output
3. **Check source**: Ensure completion script is sourced in your shell config
4. **Reload shell**: Restart terminal or run `source ~/.bashrc`

### Missing Commands

1. **Check Bunoshfile**: Ensure functions are properly exported
2. **Regenerate**: Run completion generation again
3. **Syntax**: Verify JSDoc comments are properly formatted

### Error Messages

```bash
# If you see "Unsupported shell"
bunosh completion fish  # Use: bash, zsh, or fish

# If completion script is empty
# Check that Bunoshfile.js exists and has exported functions
```

## Advanced

### Custom Completion

The completion system automatically detects:
- Exported functions → commands
- JSDoc comments → descriptions  
- Function arguments → parameter completion
- npm scripts → `npm:*` commands

### Multiple Bunoshfiles

Completion works with the Bunoshfile.js in your current directory. For different projects, regenerate completion when switching contexts or use project-specific aliases.