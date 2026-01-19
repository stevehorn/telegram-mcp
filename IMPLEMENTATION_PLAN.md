# Telegram Group Search MCP Server - Implementation Plan

## Overview

This document outlines the implementation plan for building an MCP (Model Context Protocol) server that enables searching messages in a Telegram group. The server will integrate with OpenCode to provide AI-powered access to Telegram group conversations.

## Technical Architecture

### Components

1. **MCP Server** - Local server using `@modelcontextprotocol/sdk`
2. **Telegram Client** - Using `telegram` (GramJS) library for MTProto API access
3. **Authentication Handler** - Session management for Telegram user authentication
4. **Search Tool** - Message search functionality with keyword matching

### Technology Stack

- **Language**: TypeScript/Node.js
- **MCP Framework**: `@modelcontextprotocol/sdk`
- **Telegram API**: `telegram` (GramJS) - MTProto User API
- **Environment Management**: `dotenv`
- **CLI Interaction**: `input` (for authentication prompts)

## Project Structure

```
telegram-mcp/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── telegram.ts        # Telegram client setup & auth
│   ├── tools/
│   │   └── search.ts      # Search messages tool implementation
│   └── types.ts           # TypeScript types
├── IMPLEMENTATION_PLAN.md
└── README.md
```

## Implementation Steps

### 1. Project Setup

**Tasks:**
- Initialize Node.js/TypeScript project
- Install required dependencies
- Configure TypeScript compiler options
- Set up build scripts
- Create `.gitignore` to exclude sensitive files

**Dependencies:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "telegram": "^2.24.0",
    "dotenv": "^16.4.0",
    "input": "^1.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "tsx": "^4.0.0"
  }
}
```

### 2. Telegram API Setup

**Prerequisites:**
- Obtain API credentials from https://my.telegram.org
  - Navigate to "API development tools"
  - Create a new application
  - Note your `api_id` and `api_hash`

**Configuration:**
Create `.env.example` file with:
```env
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=your_phone_number
TELEGRAM_SESSION=your_session_string_here
TELEGRAM_GROUP_ID=your_group_id_here
```

**Group Information:**
- Target Group: `https://t.me/+2hmd_IuFtmkwOTFh`
- This is a private group (requires invitation)
- User must be a member to access

### 3. Authentication System

**Implementation Details:**

**Initial Authentication Flow:**
1. Prompt for phone number
2. Send authentication code via Telegram
3. Prompt user to enter code
4. Handle 2FA if enabled
5. Generate and save session string

**Session Persistence:**
- Save session string to `.env` file or dedicated session file
- Reuse session for subsequent runs
- Implement session validation on startup

**Security Considerations:**
- Never commit session strings to version control
- Store credentials in environment variables
- Add session files to `.gitignore`
- Use secure file permissions for session storage

**Files:**
- `src/telegram.ts` - Telegram client initialization and auth logic
- `scripts/authenticate.ts` - Interactive authentication script

### 4. Search Tool Implementation

**Tool Specification:**

**Name:** `search_messages`

**Description:** Search for messages in the Telegram group by keyword

**Parameters:**
- `query` (string, required): Search keyword or phrase
- `limit` (number, optional): Maximum number of results (default: 10, max: 50)
- `offset` (number, optional): Skip N messages for pagination (default: 0)

**Return Format:**
```typescript
interface SearchResult {
  success: boolean;
  results: Array<{
    messageId: number;
    senderId: number;
    senderName: string;
    senderUsername?: string;
    text: string;
    date: string; // ISO 8601 format
    link?: string; // Deep link to message if available
  }>;
  totalFound: number;
  hasMore: boolean;
}
```

**Implementation Logic:**
1. Validate input parameters
2. Connect to Telegram client
3. Resolve group entity from invite link or ID
4. Execute search query using Telegram API
5. Format results into structured response
6. Handle errors gracefully

**Files:**
- `src/tools/search.ts` - Search tool implementation
- `src/types.ts` - TypeScript interfaces

### 5. MCP Server Setup

**Server Configuration:**

**Transport:** stdio (standard input/output)
- This is the standard transport for local MCP servers
- Compatible with OpenCode's local MCP server configuration

**Server Capabilities:**
- Tools: `search_messages`
- Error handling with descriptive messages
- Logging for debugging (optional, to stderr)

**Implementation:**
1. Initialize MCP server with stdio transport
2. Register available tools
3. Implement tool request handlers
4. Set up proper error responses
5. Add graceful shutdown handling

**Files:**
- `src/index.ts` - Main MCP server entry point

### 6. Configuration & Testing

**Testing Checklist:**

**Authentication:**
- [ ] First-time authentication flow works
- [ ] Session persistence works
- [ ] 2FA handling (if applicable)
- [ ] Invalid credentials handling

**Search Functionality:**
- [ ] Basic keyword search returns results
- [ ] Case-insensitive search works
- [ ] Limit parameter respected
- [ ] Offset/pagination works
- [ ] Empty results handled gracefully
- [ ] Special characters in query handled

**Error Handling:**
- [ ] Network errors reported clearly
- [ ] Invalid group ID handled
- [ ] Rate limiting handled
- [ ] Permission errors handled

**Scripts:**
- Create `scripts/test-search.ts` for manual testing
- Create `scripts/authenticate.ts` for initial setup

### 7. OpenCode Integration

**Configuration File:**

Add to `~/.config/opencode/opencode.json` (or project-specific config):

```json
{
  "mcp": {
    "telegram": {
      "type": "local",
      "command": ["node", "/absolute/path/to/telegram-mcp/dist/index.js"],
      "environment": {
        "TELEGRAM_API_ID": "{env:TELEGRAM_API_ID}",
        "TELEGRAM_API_HASH": "{env:TELEGRAM_API_HASH}",
        "TELEGRAM_SESSION": "{env:TELEGRAM_SESSION}",
        "TELEGRAM_GROUP_ID": "{env:TELEGRAM_GROUP_ID}"
      },
      "enabled": true
    }
  }
}
```

**Usage Examples:**

```
Search for messages about "deployment" in the Telegram group using the telegram tool
```

```
Find recent discussions about "bug fix" in Telegram, use the telegram tool
```

```
What did people say about "release" in the Telegram group? use telegram
```

### 8. Documentation

**README.md Contents:**
1. Project description
2. Prerequisites and setup instructions
3. Installation steps
4. Authentication guide
5. Configuration reference
6. Usage examples
7. Troubleshooting guide
8. API reference for tools

## Key Considerations

### Authentication

- **First Run**: Requires interactive phone number authentication
- **Subsequent Runs**: Uses saved session string
- **Session Expiry**: Handle gracefully and prompt for re-authentication
- **Security**: Session strings provide full account access - protect carefully

### Group Access

- User account must be a member of the target group
- Private groups require invitation
- The invite link format `+2hmd_IuFtmkwOTFh` is a private group hash
- May need to resolve group ID from invite link on first access

### Rate Limiting

- Telegram enforces rate limits on API requests
- Start with conservative limits (10-50 messages per query)
- Implement exponential backoff for rate limit errors
- Consider caching frequently accessed messages

### Message Types

**Phase 1 (Initial Implementation):**
- Text messages only
- Simple keyword matching

**Phase 2 (Future Enhancement):**
- Search in media captions
- Search in file names
- Filter by sender
- Date range filtering
- Advanced search operators (AND, OR, NOT)

### Security Best Practices

1. **Never commit sensitive data:**
   - API credentials
   - Session strings
   - Phone numbers
   - Group IDs (if private)

2. **Use environment variables:**
   - Store all secrets in `.env` file
   - Reference via `{env:VAR_NAME}` in configs

3. **File permissions:**
   - Set restrictive permissions on session files (600)
   - Ensure `.env` is not world-readable

4. **Error messages:**
   - Don't expose sensitive data in error messages
   - Log detailed errors to stderr, return sanitized errors to client

## Development Workflow

### Phase 1: Core Setup (Foundation)
1. Initialize project structure
2. Set up TypeScript and build configuration
3. Install dependencies
4. Create basic file structure

### Phase 2: Telegram Integration
1. Implement Telegram client initialization
2. Create authentication flow
3. Test connection to Telegram API
4. Implement session persistence

### Phase 3: Search Implementation
1. Implement search tool logic
2. Add result formatting
3. Test with various queries
4. Add error handling

### Phase 4: MCP Server
1. Set up MCP server with stdio transport
2. Register search tool
3. Implement request handlers
4. Add logging and debugging

### Phase 5: Testing & Integration
1. Manual testing of all functionality
2. OpenCode integration and testing
3. Documentation
4. Create example usage scenarios

## Expected Outcomes

After implementation, users will be able to:

1. **Search Telegram Group Messages:**
   - Use natural language queries in OpenCode
   - Get formatted search results with context
   - Access message metadata (sender, date, link)

2. **Seamless Integration:**
   - Search works directly from OpenCode prompts
   - No need to manually open Telegram
   - Results integrated into AI conversation context

3. **Easy Setup:**
   - One-time authentication process
   - Simple environment variable configuration
   - Clear documentation for troubleshooting

## Future Enhancements

Potential features for future iterations:

1. **Advanced Search:**
   - Filter by date range
   - Filter by sender
   - Search in media captions
   - Regular expression support

2. **Additional Tools:**
   - `get_recent_messages` - Fetch latest messages
   - `get_message_by_id` - Retrieve specific message
   - `list_members` - Get group member information
   - `get_group_info` - Fetch group metadata

3. **Performance:**
   - Message caching
   - Incremental sync
   - Search index for faster queries

4. **Multi-Group Support:**
   - Search across multiple groups
   - Group selection in tool parameters
   - Aggregated search results

## Resources

- **Telegram API Documentation**: https://core.telegram.org/api
- **GramJS Documentation**: https://gram.js.org/
- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **OpenCode MCP Guide**: https://opencode.ai/docs/mcp-servers/

## Timeline Estimate

- **Phase 1**: 1-2 hours (Project setup)
- **Phase 2**: 2-3 hours (Telegram integration & auth)
- **Phase 3**: 2-3 hours (Search implementation)
- **Phase 4**: 1-2 hours (MCP server setup)
- **Phase 5**: 1-2 hours (Testing & documentation)

**Total Estimated Time**: 7-12 hours

## Success Criteria

The project will be considered complete when:

- [x] Project structure is set up
- [ ] Telegram authentication works reliably
- [ ] Search tool returns accurate results
- [ ] MCP server integrates with OpenCode
- [ ] Documentation is complete and clear
- [ ] Error handling is robust
- [ ] Security best practices are followed
