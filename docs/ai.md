# AI Integration

Built-in AI support for code generation, documentation, and automation.
Automatically responds to structured JSON output.

AI provider automatically detected, but you need to provide API key and model name.
Use `.env` file with `AI_MODEL` and `OPENAI_API_KEY` variables.
In case you use provider other than OpenAI, Anthropic, Groq, you may need to configure it manually in top of Bunoshfile

## Configuration

```bash
# Choose your AI model
export AI_MODEL=gpt-5  # or claude-4-sonnet, llama-3.3-70b, etc.

# Set API key for your provider
export OPENAI_API_KEY=your_key_here      # For OpenAI
# export ANTHROPIC_API_KEY=your_key_here  # For Claude
# export GROQ_API_KEY=your_key_here       # For Groq
```

## Usage

Use the `ai` function to interact with the AI.

```js
const resp = await ai(message, { field1: 'what should be there', field2: 'what should be there' })
```

### Example: AI-Powered Commit Messages

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

### Example: Documentation Generation

```javascript
/**
 * Generate API documentation from code comments
 */
export async function generateDocs() {
  const sourceFiles = await exec`find src -name "*.js" | head -10`;

  for (const file of sourceFiles.lines) {
    const content = await exec`cat ${file}`;

    const docs = await ai(
      `Generate comprehensive API documentation for this JavaScript code:\n\n${content.output}`,
      {
        functionName: 'Function name',
        description: 'What the function does',
        parameters: 'Parameters and their types',
        returns: 'Return value description',
        examples: 'Usage examples'
      }
    );

    const documentation = await docs.json();

    writeToFile(`docs/${file.replace('src/', '').replace('.js', '.md')}`, (line) => {
      line(`# ${documentation.functionName}\n`);
      line(`${documentation.description}\n`);
      line(`## Parameters\n${documentation.parameters}\n`);
      line(`## Returns\n${documentation.returns}\n`);
      line(`## Examples\n${documentation.examples}\n`);
    });
  }

  say('📚 Documentation generated successfully');
}
```

### Example: Code Review Assistant

```javascript
/**
 * AI-powered code review
 */
export async function reviewChanges() {
  const diff = await exec`git diff HEAD~1`;

  if (!diff.output.trim()) {
    say('No changes to review');
    return;
  }

  const review = await ai(
    `Review this code diff and provide constructive feedback:\n\n${diff.output}`,
    {
      issues: 'Potential bugs or issues found',
      suggestions: 'Improvement suggestions',
      bestPractices: 'Best practices violations',
      security: 'Security concerns'
    }
  );

  const feedback = await review.json();

  if (feedback.issues) {
    yell('🐛 Issues found:');
    say(feedback.issues);
  }

  if (feedback.suggestions) {
    say('💡 Suggestions:');
    say(feedback.suggestions);
  }

  if (feedback.security) {
    yell('🔒 Security concerns:');
    say(feedback.security);
  }

  if (!feedback.issues && !feedback.security) {
    say('✅ Code looks good!');
  }
}
```

See more AI usage examples in [examples.md](examples.md).