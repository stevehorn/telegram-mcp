# Telegram MCP Server

An MCP (Model Context Protocol) server that enables searching Telegram group messages. Integrates seamlessly with OpenCode and other MCP clients to provide AI-powered access to your Telegram conversations.

## Features

- 🔍 **Search Messages**: Search for messages in Telegram groups by keyword or phrase
- 🔐 **Secure Authentication**: Uses Telegram's MTProto User API with session persistence
- 📱 **Private Group Support**: Access private groups you're a member of
- 🔗 **Message Links**: Get direct links to messages for easy reference
- 🤖 **MCP Compatible**: Works with OpenCode and other MCP clients

## Prerequisites

- Node.js 18 or higher
- A Telegram account
- Membership in the Telegram group you want to search
- Telegram API credentials (get from https://my.telegram.org)

## Installation

1. **Clone or download this repository**

```bash
cd telegram-mcp
```

2. **Install dependencies**

```bash
npm install
```

3. **Copy the environment template**

```bash
cp .env.example .env
```

4. **Get your Telegram API credentials**

   - Go to https://my.telegram.org
   - Log in with your phone number
   - Navigate to "API development tools"
   - Create a new application
   - Copy your `api_id` and `api_hash`

5. **Edit `.env` file**

Open `.env` and fill in your credentials:

```env
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=+1234567890
TELEGRAM_SESSION=
TELEGRAM_GROUP_ID=your_group_id_or_invite_hash
```

**Notes:**
- `TELEGRAM_PHONE`: Your phone number with country code (e.g., +1234567890)
- `TELEGRAM_SESSION`: Leave empty initially (will be filled by auth script)
- `TELEGRAM_GROUP_ID`: For a private invite link like `https://t.me/+ABC123XYZ`, use `ABC123XYZ`. For public groups like `https://t.me/mygroup`, use `mygroup`

## Authentication

Before using the MCP server, you need to authenticate with Telegram once:

```bash
npm run auth
```

This interactive script will:
1. Ask for your phone number (if not in `.env`)
2. Send a verification code to your Telegram app
3. Prompt you to enter the code
4. Handle 2FA if enabled on your account
5. Generate and save a session string to `.env`

**Important:** Keep your session string secure! It provides full access to your Telegram account.

## Build

Compile the TypeScript code:

```bash
npm run build
```

This creates the compiled JavaScript in the `dist/` directory.

## OpenCode Integration

### Add to OpenCode Configuration

Add this to your `opencode.json` (or `~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "telegram": {
      "type": "local",
      "command": ["node", "/absolute/path/to/telegram-mcp/dist/index.js"],
      "environment": {
        "TELEGRAM_API_ID": "{env:TELEGRAM_API_ID}",
        "TELEGRAM_API_HASH": "{env:TELEGRAM_API_HASH}",
        "TELEGRAM_PHONE": "{env:TELEGRAM_PHONE}",
        "TELEGRAM_SESSION": "{env:TELEGRAM_SESSION}",
        "TELEGRAM_GROUP_ID": "{env:TELEGRAM_GROUP_ID}"
      },
      "enabled": true
    }
  }
}
```

**Important:** Replace `/absolute/path/to/telegram-mcp` with the actual absolute path to this directory.

### Alternative: Direct Environment Variables

If you prefer not to use `{env:}` references, you can put the values directly:

```json
{
  "mcp": {
    "telegram": {
      "type": "local",
      "command": ["node", "/absolute/path/to/telegram-mcp/dist/index.js"],
      "environment": {
        "TELEGRAM_API_ID": "12345678",
        "TELEGRAM_API_HASH": "abcdef1234567890abcdef1234567890",
        "TELEGRAM_PHONE": "+1234567890",
        "TELEGRAM_SESSION": "your_session_string_here",
        "TELEGRAM_GROUP_ID": "your_group_id_or_invite_hash"
      },
      "enabled": true
    }
  }
}
```

**Note:** Be careful not to commit your `opencode.json` with sensitive credentials to version control.

## Usage

Once configured in OpenCode, you can use natural language to search your Telegram group:

### Basic Search

```
Search for messages about "deployment" in the Telegram group using the telegram tool
```

```
Find discussions about "bug fix" in Telegram, use the telegram tool
```

### Advanced Queries

```
Search for "release notes" in the last 50 messages using telegram
```

```
What did people say about "meeting" in the Telegram group? use telegram search_messages
```

### Tool Reference

The MCP server exposes one tool: `search_messages`

**Parameters:**
- `query` (string, required): Search keyword or phrase
- `limit` (number, optional): Maximum results to return (default: 10, max: 100)
- `offset` (number, optional): Skip N messages for pagination (default: 0)

**Returns:**
```typescript
{
  success: boolean;
  results: Array<{
    messageId: number;
    senderId: number;
    senderName: string;
    senderUsername?: string;
    text: string;
    date: string; // ISO 8601 format
    link?: string; // Deep link to message
  }>;
  totalFound: number;
  hasMore: boolean;
  error?: string;
}
```

## Troubleshooting

### Authentication Errors

**Error: "Not authorized"**
- Run `npm run auth` again to re-authenticate
- Make sure `TELEGRAM_SESSION` is set in `.env`

**Error: "PHONE_NUMBER_INVALID"**
- Ensure phone number includes country code (e.g., +1234567890)
- No spaces or special characters except `+`

### Connection Issues

**Error: "Failed to resolve group"**
- Verify you're a member of the group
- Check `TELEGRAM_GROUP_ID` is correct
- For invite links like `https://t.me/+hash`, use just the hash part

**Error: "Connection timeout"**
- Check your internet connection
- Telegram may be blocked in your region (use a VPN)

### OpenCode Integration Issues

**Tool not showing up in OpenCode**
- Verify the path in `opencode.json` is absolute
- Run `npm run build` to ensure compiled code is up to date
- Check OpenCode logs for MCP connection errors

**Environment variables not loading**
- Make sure `.env` file exists in the project root
- Verify environment variables are correctly set
- Try using direct values instead of `{env:}` references

### Rate Limiting

If you're hitting rate limits:
- Reduce the `limit` parameter in searches
- Add delays between requests
- Telegram enforces flood protection automatically

## Development

### Project Structure

```
telegram-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── telegram.ts        # Telegram client & auth
│   ├── types.ts           # TypeScript types
│   └── tools/
│       └── search.ts      # Search implementation
├── scripts/
│   └── authenticate.ts    # Authentication script
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Development Mode

Run without building:

```bash
npm run dev
```

Watch mode (auto-rebuild on changes):

```bash
npm run watch
```

### Adding New Tools

1. Create a new file in `src/tools/`
2. Implement the tool function
3. Register it in `src/index.ts` in the `ListToolsRequestSchema` handler
4. Add a case in the `CallToolRequestSchema` handler

## Security Best Practices

- ✅ Never commit `.env` file to version control
- ✅ Keep your session string secret (it's like a password)
- ✅ Use environment variables for sensitive data
- ✅ Be cautious sharing your `opencode.json` if it contains credentials
- ✅ Regularly rotate API credentials if compromised
- ✅ Use restrictive file permissions on `.env` (chmod 600)

## API Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_API_ID` | Yes | Your API ID from my.telegram.org |
| `TELEGRAM_API_HASH` | Yes | Your API hash from my.telegram.org |
| `TELEGRAM_PHONE` | Yes | Your phone number with country code |
| `TELEGRAM_SESSION` | Yes | Session string (generated by auth script) |
| `TELEGRAM_GROUP_ID` | Yes | Group ID or invite hash to search |

### Search Tool

**Name:** `search_messages`

**Input Schema:**
```json
{
  "query": "string (required)",
  "limit": "number (optional, default: 10, max: 100)",
  "offset": "number (optional, default: 0)"
}
```

**Output Schema:**
```json
{
  "success": "boolean",
  "results": [
    {
      "messageId": "number",
      "senderId": "number",
      "senderName": "string",
      "senderUsername": "string?",
      "text": "string",
      "date": "string (ISO 8601)",
      "link": "string?"
    }
  ],
  "totalFound": "number",
  "hasMore": "boolean",
  "error": "string?"
}
```

## Future Enhancements

Potential features for future versions:

- 📅 **Date Range Filtering**: Search within specific time periods
- 👤 **Sender Filtering**: Find messages from specific users
- 🖼️ **Media Search**: Search in photo/video captions and file names
- 📊 **Message Statistics**: Analyze message patterns and trends
- 🔄 **Multi-Group Support**: Search across multiple groups
- 💾 **Local Caching**: Speed up repeated searches
- 🔎 **Advanced Queries**: Support regex and boolean operators

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Resources

- [Telegram API Documentation](https://core.telegram.org/api)
- [GramJS (Telegram Library)](https://gram.js.org/)
- [Model Context Protocol](https://spec.modelcontextprotocol.io/)
- [OpenCode Documentation](https://opencode.ai/docs)

## Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review Telegram API limits and restrictions
3. Check OpenCode logs for detailed error messages
4. Open an issue with detailed error information

---

Made with ❤️ for the OpenCode and Telegram communities
