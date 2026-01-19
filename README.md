# Telegram MCP Server

MCP server for searching Telegram group messages.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Get Telegram API credentials from https://my.telegram.org

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` with your credentials:
```env
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_SESSION=
TELEGRAM_GROUP_ID=your_group_id_or_invite_hash
```

For `TELEGRAM_GROUP_ID`:
- Private group invite link `https://t.me/+ABC123XYZ` → use `ABC123XYZ`
- Public group `https://t.me/mygroup` → use `mygroup`

5. Authenticate with Telegram:
```bash
npm run auth
```

This will prompt for a verification code and save the session to `.env`.

6. Build:
```bash
npm run build
```

## OpenCode Configuration

Add to `opencode.json`:

```json
{
  "mcp": {
    "telegram": {
      "type": "local",
      "command": ["node", "/absolute/path/to/telegram-mcp/dist/src/index.js"],
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

Replace `/absolute/path/to/telegram-mcp` with the actual path.

## Usage

The server exposes a `search_messages` tool with advanced filtering and sorting capabilities.

### Parameters

- `query` (string, required) - Search keyword or phrase
- `limit` (number, optional) - Max results (default: 10, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)
- `sortBy` (string, optional) - Sort order: `relevance` (default), `date_desc`, `date_asc`
- `startDate` (string, optional) - Filter messages after this date
- `endDate` (string, optional) - Filter messages before this date
- `dateRange` (string, optional) - Convenience shortcuts: `last24h`, `last7days`, `last30days`, `last90days`
- `includeExtendedMetadata` (boolean, optional) - Include reactions, views, edit history (default: false)

### Date Filtering

The date parameters support multiple formats:

1. **ISO 8601**: `"2024-01-15T10:30:00Z"`
2. **Unix timestamp**: `1705317000` (seconds or milliseconds)
3. **Natural language**: `"3 days ago"`, `"last week"`, `"yesterday"`, `"2 weeks ago"`
4. **Shortcuts**: `last24h`, `last7days`, `last30days`, `last90days`

**Date Priority**: `startDate`/`endDate` parameters override `dateRange` if both are provided.

### Extended Metadata

When `includeExtendedMetadata` is true, results include:
- **Reactions**: Emoji reactions with counts
- **View counts**: Number of views (for channel messages)
- **Edit history**: Indicates if message was edited and when
- **Pinned status**: Whether the message is pinned
- **Reply context**: Information about replied messages (ID, sender, text snippet)
- **Forward information**: Details if message was forwarded (source chat, message ID, date)
- **Media attachments**: Type, filename, mime type, size for photos, videos, documents

**Note**: Extended metadata requires additional API calls and may impact performance. Use only when needed.

### Examples

**Basic search:**
```
Search for "deployment" using the telegram tool
```

**Search with date range:**
```
Search for "error" in the last 7 days sorted by relevance
```

**Search with custom dates:**
```
Search for "meeting" between 2024-01-01 and 2024-01-15
```

**Natural language dates:**
```
Search for "standup" from 3 days ago to yesterday
```

**Advanced search with metadata:**
```
Search for "announcement" with extended metadata in the last month, sorted by date
```

**Sort by date (newest first):**
```
Search for "release" sorted by date_desc
```

**Sort by date (oldest first):**
```
Search for "bug" sorted by date_asc in the last 30 days
```

## License

MIT
