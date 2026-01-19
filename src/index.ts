#!/usr/bin/env node

/**
 * Telegram MCP Server
 * Provides search functionality for Telegram group messages
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { initializeTelegram, disconnectTelegram } from './telegram.js';
import { searchMessages } from './tools/search.js';
import type { TelegramConfig, SearchParams } from './types.js';

// Load environment variables
config();

// Validate configuration
function getConfig(): TelegramConfig {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const phone = process.env.TELEGRAM_PHONE;
  const session = process.env.TELEGRAM_SESSION || '';
  const groupId = process.env.TELEGRAM_GROUP_ID;

  if (!apiId || !apiHash || !phone || !groupId) {
    throw new Error(
      'Missing required environment variables. Please check your .env file.\n' +
      'Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE, TELEGRAM_GROUP_ID'
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    phone,
    session,
    groupId,
  };
}

// Initialize the MCP server
const server = new Server(
  {
    name: 'telegram-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_messages',
        description: 'Search for messages in the Telegram group by keyword or phrase',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (keyword or phrase)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 10, max: 100)',
              default: 10,
            },
            offset: {
              type: 'number',
              description: 'Number of results to skip for pagination (default: 0)',
              default: 0,
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_messages') {
    try {
      const params = args as unknown as SearchParams;
      
      // Validate parameters
      if (!params.query || typeof params.query !== 'string') {
        throw new Error('Query parameter is required and must be a string');
      }

      if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 100)) {
        throw new Error('Limit must be a number between 1 and 100');
      }

      if (params.offset !== undefined && (typeof params.offset !== 'number' || params.offset < 0)) {
        throw new Error('Offset must be a non-negative number');
      }

      const config = getConfig();
      const result = await searchMessages(config, params);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error.message || 'Unknown error occurred',
              results: [],
              totalFound: 0,
              hasMore: false,
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// Main function to start the server
async function main() {
  try {
    // Get configuration
    const config = getConfig();
    
    // Initialize Telegram client
    console.error('Connecting to Telegram...');
    await initializeTelegram(config);
    console.error('Connected to Telegram successfully');

    // Start the MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Telegram MCP server started');

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down...');
      await disconnectTelegram();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Shutting down...');
      await disconnectTelegram();
      process.exit(0);
    });
  } catch (error: any) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
