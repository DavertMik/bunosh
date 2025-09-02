import { TaskResult, createTaskInfo, finishTaskInfo } from '../task.js';
import Printer from '../printer.js';
import { generateObject, generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';

let customConfiguration = null;

const PROVIDER_REGISTRY = {
  OPENAI_API_KEY: (modelName) => openai(modelName),
  ANTHROPIC_API_KEY: (modelName) => anthropic(modelName),
  GROQ_API_KEY: (modelName) => createGroq({ apiKey: process.env.GROQ_API_KEY })(modelName),
  GROQ_KEY: (modelName) => createGroq({ apiKey: process.env.GROQ_KEY })(modelName)
};

const customProviders = new Map();

function detectProvider() {
  if (customConfiguration) {
    return customConfiguration.model;
  }

  if (!process.env.AI_MODEL) {
    throw new Error('AI_MODEL environment variable is required. Set it to specify which model to use (e.g., AI_MODEL=gpt-4o, AI_MODEL=claude-3-5-sonnet-20241022, AI_MODEL=llama-3.3-70b-versatile).');
  }

  for (const [envVar, provider] of customProviders) {
    if (process.env[envVar]) {
      return provider.createInstance(process.env.AI_MODEL);
    }
  }

  for (const [envVar, createInstance] of Object.entries(PROVIDER_REGISTRY)) {
    if (process.env[envVar]) {
      return createInstance(process.env.AI_MODEL);
    }
  }

  const availableProviders = [
    ...Object.keys(PROVIDER_REGISTRY),
    ...Array.from(customProviders.keys())
  ];

  throw new Error(`No AI provider configured. Set one of these environment variables: ${availableProviders.join(', ')}. Or use ai.configure() for custom setup.`);
}

function configure(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('ai.configure() requires a configuration object');
  }

  if (config.model && typeof config.model === 'object') {
    customConfiguration = { model: config.model };
    return;
  }

  if (config.registerProvider) {
    const { envVar, provider } = config.registerProvider;
    if (!envVar || !provider) {
      throw new Error('registerProvider requires { envVar: "ENV_VAR_NAME", provider: { createInstance: (model) => providerInstance } }');
    }
    customProviders.set(envVar, provider);
    return;
  }

  throw new Error('Invalid configuration. Use ai.configure({ model: providerInstance }) or ai.configure({ registerProvider: { envVar: "CUSTOM_API_KEY", provider: { createInstance: (model) => customProvider(model) } } })');
}

function createSchema(outputFormat) {
  const schemaObject = {};
  for (const [key, description] of Object.entries(outputFormat)) {
    schemaObject[key] = z.string().describe(description);
  }

  return z.object(schemaObject);
}

function createProgressIndicator() {
  const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  
  return setInterval(() => {
    const spinner = dots[index % dots.length];
    process.stdout.write(`\r${spinner} Generating...`);
    index++;
  }, 100);
}

async function ai(prompt, outputFormat = null) {
  const cleanPrompt = prompt.replace(/\s+/g, ' ').trim();
  const taskName = `AI: ${cleanPrompt.substring(0, 50)}${cleanPrompt.length > 50 ? '...' : ''}`;
  
  const taskInfo = createTaskInfo(taskName);
  const printer = new Printer('ai', taskInfo.id);
  printer.start(taskName);

  // Start progress indicator
  const progressInterval = createProgressIndicator();

  try {
    const model = detectProvider();
    let result, usage;
    
    if (outputFormat) {
      const schema = createSchema(outputFormat);
      const response = await generateObject({ model, prompt, schema });
      result = response.object;
      usage = response.usage;
    } else {
      const response = await generateText({ model, prompt });
      result = response.text;
      usage = response.usage;
    }
    
    clearInterval(progressInterval);
    process.stdout.write('\r' + ' '.repeat(20) + '\r');
    const tokenInfo = usage ? `${usage.totalTokens} tokens` : '';
    printer.finish(taskName, { tokenInfo });
    finishTaskInfo(taskInfo, true, null, outputFormat ? JSON.stringify(result, null, 2) : result);
    return TaskResult.success(result);
    
  } catch (error) {
    clearInterval(progressInterval);
    process.stdout.write('\r' + ' '.repeat(20) + '\r');
    printer.error(taskName, error);
    finishTaskInfo(taskInfo, false, error, error.message);
    return TaskResult.fail(error.message);
  }
}

ai.configure = configure;

ai.reset = function() {
  customConfiguration = null;
};

ai.getConfig = function() {
  return customConfiguration;
};

export default ai;