import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { processCommands } from './program.js';

// Global state for managing conversations and pending questions
const conversations = new Map();

/**
 * Convert BunoshCommand objects to MCP tools
 * @param {Array<BunoshCommand>} parsedCommands - Array of parsed BunoshCommand objects
 * @returns {Object} MCP tools object
 */
function createMcpTools(parsedCommands) {
  const tools = {};

  parsedCommands.forEach((command) => {
    // Create input schema for the tool
    const properties = {};
    const required = [];

    // Add positional arguments
    Object.entries(command.args).forEach(([argName, defaultValue]) => {
      properties[argName] = {
        type: 'string',
        description: `Argument: ${argName}`,
      };
      if (defaultValue === undefined) {
        required.push(argName);
      }
    });

    // Add options
    Object.entries(command.opts).forEach(([optName, defaultValue]) => {
      properties[optName] = {
        type: typeof defaultValue === 'boolean' ? 'boolean' : 'string',
        description: `Option: --${optName}`,
      };
      // Don't make options required as they have defaults
    });

    tools[command.fullName] = {
      name: command.fullName,
      description: command.comment || `Bunosh command: ${command.fullName}`,
      inputSchema: {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      },
    };
  });

  // Add the answer tool for handling interactive questions
  tools.answer = {
    name: 'answer',
    description: 'Provide an answer to a question asked by a Bunosh command',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: {
          type: 'string',
          description: 'The ID of the conversation to answer',
        },
        questionId: {
          type: 'string',
          description: 'The ID of the question to answer',
        },
        answer: {
          oneOf: [
            { type: 'string' },
            { type: 'boolean' },
            { type: 'array', items: { type: 'string' } }
          ],
          description: 'The answer to provide - can be string, boolean, or array of strings for multiple choice',
        }
      },
      required: ['conversationId', 'questionId', 'answer'],
    },
  };

  return tools;
}

/**
 * Create a conversation state for tracking multi-question interactions
 * @param {string} conversationId - Unique conversation identifier
 * @param {BunoshCommand} command - The command being executed
 * @param {Object} args - Command arguments
 * @returns {Object} Conversation state object
 */
function createConversation(conversationId, command, args) {
  const conversation = {
    id: conversationId,
    command,
    args,
    questions: [], // List of questions asked in this conversation
    answers: {},  // Map of questionId to answer
    currentQuestion: null,
    output: [],
    isComplete: false,
    result: null,
    startTime: Date.now()
  };

  conversations.set(conversationId, conversation);
  return conversation;
}

/**
 * Create an interactive ask function that works with conversation state
 * @param {Object} conversation - The conversation state
 * @returns {Function} Interactive ask function
 */
function createConversationAskFunction(conversation) {
  return async (question, defaultValueOrOptions = {}, options = {}) => {
    // Check if we already have an answer for this exact question text
    // Look for ANY question with the same text that has an answer
    // Important: Use 'in' operator to check if key exists, even if the value is falsy (like false)
    const existingQuestionWithAnswer = conversation.questions.find(q => q.message === question && q.id in conversation.answers);

    if (existingQuestionWithAnswer) {
      return conversation.answers[existingQuestionWithAnswer.id];
    }

    // Generate a unique question ID
    const questionId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Parse the question options to understand what type of answer is expected
    let questionOptions = {};
    let expectedType = 'string';

    // Smart parameter detection (copied from original ask function)
    if (defaultValueOrOptions !== null && typeof defaultValueOrOptions !== 'object') {
      questionOptions.default = defaultValueOrOptions;
      questionOptions = { ...questionOptions, ...options };

      if (typeof defaultValueOrOptions === 'boolean') {
        expectedType = 'boolean';
      }
    } else if (Array.isArray(defaultValueOrOptions)) {
      questionOptions.choices = defaultValueOrOptions;
      questionOptions = { ...questionOptions, ...options };
      expectedType = 'choices';
    } else {
      questionOptions = { ...defaultValueOrOptions, ...options };
      if (questionOptions.type === 'confirm') {
        expectedType = 'boolean';
      } else if (questionOptions.choices) {
        expectedType = 'choices';
      }
    }

    // Store the question data
    const questionData = {
      id: questionId,
      conversationId: conversation.id,
      message: question,
      options: questionOptions,
      expectedType,
      choices: questionOptions.choices || null,
      multiple: questionOptions.multiple || false,
      timestamp: Date.now()
    };

    // Add question to conversation (only if it's not already there)
    // Check if this exact question already exists
    const existingQuestion = conversation.questions.find(q => q.message === question);
    if (!existingQuestion) {
      conversation.questions.push(questionData);
      conversation.currentQuestion = questionData;
    } else {
      conversation.currentQuestion = existingQuestion;
    }

    // Throw a special error to signal the MCP server that a question needs to be answered
    const questionError = new Error(`INTERACTIVE_QUESTION:${JSON.stringify(questionData)}`);
    questionError.code = 'INTERACTIVE_QUESTION';
    throw questionError;
  };
}

/**
 * Execute a Bunosh command with conversation-based multi-question support
 * @param {BunoshCommand} command - Parsed BunoshCommand object
 * @param {Object} args - Arguments from MCP tool call
 * @param {string} [conversationId] - ID for resuming an existing conversation
 * @returns {Promise<string>} Command output with task information
 */
async function executeBunoshCommand(command, args, conversationId = null) {
  // Import task functions to access executed tasks
  const { tasksExecuted } = await import('./task.js');

  // Check if we're resuming an existing conversation
  if (conversationId && conversations.has(conversationId)) {
    const conversation = conversations.get(conversationId);

    // Re-execute the command with the same conversation state
    // The ask function will return pre-provided answers for already-answered questions
    return executeCommandWithConversation(conversation);
  }

  // Create new conversation
  const newConversationId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const conversation = createConversation(newConversationId, command, args);

  return executeCommandWithConversation(conversation);
}

/**
 * Execute a command within a conversation context
 * @param {Object} conversation - The conversation state
 * @returns {Promise<string>} Command output or next question
 */
async function executeCommandWithConversation(conversation) {
  // Import task functions to access executed tasks
  const { tasksExecuted } = await import('./task.js');

  // Capture stdout/stderr
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const output = [];

  console.log = (...consoleArgs) => {
    const message = consoleArgs.join(' ');
    output.push(message);
    conversation.output.push(message);
  };

  console.error = (...consoleArgs) => {
    const message = `Error: ${consoleArgs.join(' ')}`;
    output.push(message);
    conversation.output.push(message);
  };

  try {
    // Set up conversation-based ask function
    globalThis._mcpAskFunction = createConversationAskFunction(conversation);

    // Build arguments array using the parsed command information
    const cmdArgs = [];
    const optionsObject = {};

    // Add positional arguments
    Object.keys(conversation.command.args).forEach((argName) => {
      if (conversation.args[argName] !== undefined) {
        cmdArgs.push(conversation.args[argName]);
      } else {
        // Use default value from parsed command
        cmdArgs.push(conversation.command.args[argName]);
      }
    });

    // Handle options object
    const optionKeys = Object.keys(conversation.command.opts);
    if (optionKeys.length > 0) {
      optionKeys.forEach((optName) => {
        if (conversation.args[optName] !== undefined) {
          optionsObject[optName] = conversation.args[optName];
        } else {
          // Use default value from parsed command
          optionsObject[optName] = conversation.command.opts[optName];
        }
      });
      cmdArgs.push(optionsObject);
    }

    // Execute the command
    const result = await conversation.command.function(...cmdArgs);

    // Mark conversation as complete
    conversation.isComplete = true;
    conversation.result = result;

    // Restore console and cleanup
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    delete globalThis._mcpAskFunction;

    // Get tasks executed during this command
    const executedTasks = tasksExecuted.filter(task =>
      task.startTime && task.startTime >= conversation.startTime
    );

    // Format response with task information
    const response = {
      output: output.join('\n'),
      result: result,
      tasks: executedTasks.map(task => ({
        name: task.name,
        status: task.status,
        duration: task.duration,
        output: task.result?.output || null
      }))
    };

    // Add direct output if result is a string
    if (result && typeof result === 'string') {
      response.output += (response.output ? '\n' : '') + result;
    }

    // Clean up completed conversation
    conversations.delete(conversation.id);

    // If no tasks were tracked, still return the output
    if (executedTasks.length === 0) {
      return response.output || 'Command executed successfully';
    }

    // Return JSON response with task information
    return JSON.stringify(response, null, 2);
  } catch (error) {
    // Check if this is an interactive question
    if (error.code === 'INTERACTIVE_QUESTION') {
      // Extract question data from error message
      const questionData = JSON.parse(error.message.split('INTERACTIVE_QUESTION:')[1]);

      // Format the question for the AI to answer
      let questionPrompt = `❓ **Question:** ${questionData.message}\n\n`;

      if (questionData.expectedType === 'boolean') {
        questionPrompt += `Please provide a boolean answer (true/false).`;
      } else if (questionData.expectedType === 'choices') {
        if (questionData.multiple) {
          questionPrompt += `Please select one or more choices from: ${questionData.choices.join(', ')}\n`;
          questionPrompt += `Provide the answer as an array of strings, e.g., ["option1", "option2"]`;
        } else {
          questionPrompt += `Please choose one option from: ${questionData.choices.join(', ')}\n`;
          questionPrompt += `Provide the answer as a string (the exact choice).`;
        }
      } else {
        questionPrompt += `Please provide a string answer.`;
        if (questionData.options.default !== undefined) {
          questionPrompt += ` Default value: ${questionData.options.default}`;
        }
      }

      questionPrompt += `\n\nUse the \`answer\` tool to respond with:\n`;
      questionPrompt += `- conversationId: "${questionData.conversationId}"\n`;
      questionPrompt += `- questionId: "${questionData.id}"\n`;
      questionPrompt += `- answer: <your answer>`;

      // Restore console and cleanup for now
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      delete globalThis._mcpAskFunction;

      // Return special response that prompts the AI to use the answer tool
      return JSON.stringify({
        interactive: true,
        conversationId: questionData.conversationId,
        questionId: questionData.id,
        question: questionData.message,
        prompt: questionPrompt,
        expectedType: questionData.expectedType,
        choices: questionData.choices,
        multiple: questionData.multiple,
        default: questionData.options.default,
        progress: `Question ${conversation.questions.length} of ${conversation.questions.length + 1}`
      }, null, 2);
    }

    // Handle other errors
    conversation.error = error;

    // Get tasks executed before the error
    const executedTasks = tasksExecuted.filter(task =>
      task.startTime && task.startTime >= conversation.startTime
    );

    // Format error response with task information
    const errorResponse = {
      output: output.join('\n'),
      error: error.message,
      tasks: executedTasks.map(task => ({
        name: task.name,
        status: task.status,
        duration: task.duration,
        output: task.result?.output || null
      }))
    };

    // Clean up conversation state
    conversations.delete(conversation.id);

    throw new Error(`Command execution failed: ${error.message}\n${JSON.stringify(errorResponse, null, 2)}`);
  }
}

/**
 * Handle the answer tool for responding to interactive questions
 * @param {Object} args - Tool arguments containing conversationId, questionId, and answer
 * @returns {Object} MCP response
 */
function handleAnswerTool(args) {
  const { conversationId, questionId, answer } = args;

  if (!conversationId || !questionId) {
    throw new McpError(
      ErrorCode.InvalidParams,
      'Missing required parameters: conversationId and questionId'
    );
  }

  const conversation = conversations.get(conversationId);
  if (!conversation) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No conversation found with ID: ${conversationId}`
    );
  }

  // Validate the answer based on question expectations
  let validatedAnswer = answer;
  const question = conversation.questions.find(q => q.id === questionId);

  if (!question) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `No question found with ID: ${questionId} in conversation: ${conversationId}`
    );
  }

  if (question.choices && Array.isArray(answer)) {
    // For multiple choice questions, validate that all choices are valid
    const invalidChoices = answer.filter(choice => !question.choices.includes(choice));
    if (invalidChoices.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid choices: ${invalidChoices.join(', ')}. Valid choices are: ${question.choices.join(', ')}`
      );
    }
  }

  // Store the answer
  conversation.answers[questionId] = validatedAnswer;

  return {
    content: [
      {
        type: 'text',
        text: `Answer received for question: ${question.message}`,
      },
    ],
  };
}

/**
 * Continue a conversation after receiving an answer
 * @param {string} conversationId - The conversation ID to continue
 * @returns {Promise<string>} Command output or next question
 */
async function continueConversation(conversationId) {
  const conversation = conversations.get(conversationId);
  if (!conversation) {
    throw new Error(`No conversation found with ID: ${conversationId}`);
  }

  // Execute the command again, but this time it will use pre-provided answers
  return executeCommandWithConversation(conversation);
}

/**
 * Create MCP server from Bunosh commands
 * @param {Object} commands - Commands object from Bunoshfile
 * @param {Object} sources - Sources object containing comments and metadata
 * @returns {Server} Configured MCP server
 */
export function createMcpServer(commands, sources) {
  const server = new Server(
    {
      name: 'bunosh',
      version: '0.1.5',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Process commands using the existing logic from program.js
  const parsedCommands = processCommands(commands, sources);
  const tools = createMcpTools(parsedCommands);

  // Create a map for quick command lookup
  const commandMap = new Map(parsedCommands.map(cmd => [cmd.fullName, cmd]));

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.values(tools),
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Handle the answer tool separately
    if (name === 'answer') {
      const result = handleAnswerTool(args);

      // After providing an answer, try to continue the conversation
      const { conversationId } = args;
      if (conversationId) {
        try {
          const continuationResult = await continueConversation(conversationId);
          return {
            content: [
              result.content[0], // The "Answer received" message
              {
                type: 'text',
                text: continuationResult,
              },
            ],
          };
        } catch (error) {
          // If continuation fails, just return the answer confirmation
          return result;
        }
      }

      return result;
    }

    const command = commandMap.get(name);
    if (!command) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown command: ${name}`
      );
    }

    try {
      // Check if this is a continuation of a previous conversation
      const conversationId = args.conversationId;

      // Execute the Bunosh command with provided arguments
      const result = await executeBunoshCommand(command, args, conversationId);

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Error executing command ${name}: ${error.message}`
      );
    }
  });

  return server;
}

/**
 * Start MCP server with stdio transport
 * @param {Server} server - MCP server instance
 */
export async function startMcpServer(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Server is now running and listening for MCP protocol messages
  // No need to return anything as it will handle communication via stdio
}