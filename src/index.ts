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

  if (!apiId || !apiHash || !phone) {
    throw new Error(
      'Missing required environment variables. Please check your .env file.\n' +
      'Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE'
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    phone,
    session,
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
        description: 'Search Telegram groups and channels the authenticated user belongs to. Automatically discovers and searches across all user groups (up to 50 by default). Find discussions about any topic with advanced filtering and sorting capabilities. Each result includes group context (name, ID, type) for easy identification.',
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
            sortBy: {
              type: 'string',
              enum: ['relevance', 'date_desc', 'date_asc'],
              description: 'Sort order: relevance (default), date_desc (newest first), date_asc (oldest first)',
              default: 'relevance',
            },
            startDate: {
              type: 'string',
              description: 'Filter messages after this date. Supports: ISO 8601 (2024-01-15T10:30:00Z), Unix timestamp, or natural language (3 days ago, last week)',
            },
            endDate: {
              type: 'string',
              description: 'Filter messages before this date. Same format as startDate',
            },
            dateRange: {
              type: 'string',
              enum: ['last24h', 'last7days', 'last30days', 'last90days'],
              description: 'Convenience date range shortcuts. Overridden by startDate/endDate if provided',
            },
             includeExtendedMetadata: {
               type: 'boolean',
               description: 'Include extended metadata like reactions, view counts, edit history (default: false)',
               default: false,
             },
             groupIds: {
               type: 'array',
               items: { type: 'string' },
               description: 'Optional: Array of specific group IDs to search. If provided, skips auto-discovery and searches only these groups. Format: numeric IDs (e.g., "-1001234567890") or usernames (e.g., "my_channel")',
             },
             maxGroups: {
               type: 'number',
               description: 'Maximum number of groups to auto-discover and search (default: 50, max: 200). Only used if groupIds is not provided',
               minimum: 1,
               maximum: 200,
               default: 50,
             },
             includeChannels: {
               type: 'boolean',
               description: 'Include channels in auto-discovery (default: true)',
               default: true,
             },
             includeArchivedChats: {
               type: 'boolean',
               description: 'Include archived chats in auto-discovery (default: false)',
               default: false,
             },
             groupTypes: {
               type: 'array',
               items: { 
                 type: 'string',
                 enum: ['channel', 'supergroup', 'gigagroup', 'basicgroup']
               },
               description: 'Filter by group types during auto-discovery (default: all types). Options: "channel", "supergroup", "gigagroup", "basicgroup"',
             },
             concurrencyLimit: {
               type: 'number',
               description: 'Maximum number of parallel group searches (1-10, default: 3)',
               minimum: 1,
               maximum: 10,
               default: 3,
             },
             rateLimitDelay: {
               type: 'number',
               description: 'Delay between API requests in milliseconds (0-5000, default: 1000)',
               minimum: 0,
               maximum: 5000,
               default: 1000,
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

      // Validate sortBy
      if (params.sortBy !== undefined && !['relevance', 'date_desc', 'date_asc'].includes(params.sortBy)) {
        throw new Error('sortBy must be one of: relevance, date_desc, date_asc');
      }

      // Validate dateRange
      if (params.dateRange !== undefined && !['last24h', 'last7days', 'last30days', 'last90days'].includes(params.dateRange)) {
        throw new Error('dateRange must be one of: last24h, last7days, last30days, last90days');
      }

       // Validate includeExtendedMetadata
       if (params.includeExtendedMetadata !== undefined && typeof params.includeExtendedMetadata !== 'boolean') {
         throw new Error('includeExtendedMetadata must be a boolean');
       }

       // Validate groupIds
       if (params.groupIds !== undefined) {
         if (!Array.isArray(params.groupIds)) {
           throw new Error('groupIds must be an array of strings');
         }
         if (params.groupIds.some(id => typeof id !== 'string' || !id.trim())) {
           throw new Error('All groupIds must be non-empty strings');
         }
       }

       // Validate maxGroups
       if (params.maxGroups !== undefined && (typeof params.maxGroups !== 'number' || params.maxGroups < 1 || params.maxGroups > 200)) {
         throw new Error('maxGroups must be a number between 1 and 200');
       }

       // Validate includeChannels
       if (params.includeChannels !== undefined && typeof params.includeChannels !== 'boolean') {
         throw new Error('includeChannels must be a boolean');
       }

       // Validate includeArchivedChats
       if (params.includeArchivedChats !== undefined && typeof params.includeArchivedChats !== 'boolean') {
         throw new Error('includeArchivedChats must be a boolean');
       }

       // Validate groupTypes
       if (params.groupTypes !== undefined) {
         if (!Array.isArray(params.groupTypes)) {
           throw new Error('groupTypes must be an array of strings');
         }
         const validTypes = ['channel', 'supergroup', 'gigagroup', 'basicgroup'];
         if (params.groupTypes.some(type => !validTypes.includes(type))) {
           throw new Error('groupTypes must only contain: channel, supergroup, gigagroup, basicgroup');
         }
       }

       // Validate concurrencyLimit
       if (params.concurrencyLimit !== undefined && (typeof params.concurrencyLimit !== 'number' || params.concurrencyLimit < 1 || params.concurrencyLimit > 10)) {
         throw new Error('concurrencyLimit must be a number between 1 and 10');
       }

       // Validate rateLimitDelay
       if (params.rateLimitDelay !== undefined && (typeof params.rateLimitDelay !== 'number' || params.rateLimitDelay < 0 || params.rateLimitDelay > 5000)) {
         throw new Error('rateLimitDelay must be a number between 0 and 5000');
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
