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
```

**Note**: Group configuration is no longer required! The server now automatically discovers and searches all groups/channels the authenticated user belongs to (up to 50 by default, max 200 configurable).

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
        "TELEGRAM_SESSION": "{env:TELEGRAM_SESSION}"
      },
      "enabled": true
    }
  }
}
```

Replace `/absolute/path/to/telegram-mcp` with the actual path.

## Usage

The server exposes a `search_messages` tool that automatically discovers and searches all groups/channels you belong to.

### Automatic Group Discovery

By default, the tool automatically discovers and searches across:
- All groups and channels you're a member of
- Up to 50 groups (configurable up to 200)
- Active (non-archived) chats only
- All group types: channels, supergroups, gigagroups, and basic groups

### Parameters

**Basic Search:**
- `query` (string, required) - Search keyword or phrase
- `limit` (number, optional) - Max results (default: 10, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)
- `sortBy` (string, optional) - Sort order: `relevance` (default), `date_desc`, `date_asc`

**Date Filtering:**
- `startDate` (string, optional) - Filter messages after this date
- `endDate` (string, optional) - Filter messages before this date
- `dateRange` (string, optional) - Convenience shortcuts: `last24h`, `last7days`, `last30days`, `last90days`

**Auto-Discovery Options:**
- `maxGroups` (number, optional) - Max groups to discover (default: 50, max: 200)
- `includeChannels` (boolean, optional) - Include channels (default: true)
- `includeArchivedChats` (boolean, optional) - Include archived chats (default: false)
- `groupTypes` (array, optional) - Filter by types: `["channel", "supergroup", "gigagroup", "basicgroup"]` (default: all)

**Specific Group Search:**
- `groupIds` (array, optional) - Search specific groups only (skips auto-discovery). Format: numeric IDs (e.g., "-1001234567890") or usernames (e.g., "my_channel")

**Performance:**
- `concurrencyLimit` (number, optional) - Max parallel group searches (1-10, default: 3)
- `rateLimitDelay` (number, optional) - Delay between API requests in ms (0-5000, default: 1000)

**Extended Data:**
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

**Basic auto-discovery search (searches all your groups):**
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

**Search more groups (up to 200):**
```
Search for "deployment" with maxGroups=100
```

**Search only channels:**
```
Search for "announcement" with groupTypes=["channel"]
```

**Search specific groups only (skip auto-discovery):**
```
Search for "deployment" in specific groups: ["@group1", "@group2", "-1001234567890"]
```

**Search with custom performance settings:**
```
Search for "error" with concurrency limit 5 and 500ms delay between requests
```

**Search including archived chats:**
```
Search for "old discussion" including archived chats
```

### Message Results

Each message result now includes group context:
```json
{
  "messageId": 12345,
  "text": "Check out this vendor...",
  "senderName": "John Doe",
  "groupId": "-1001234567890",
  "groupTitle": "Research Group",
  "groupType": "supergroup",
  "date": "2024-01-15T10:30:00Z",
  "link": "https://t.me/c/1234567890/12345"
}
```

This makes it easy to see which group each message came from!

## Migration Guide

### Upgrading from Previous Versions

**What Changed:**
- Group configuration is no longer required in `.env`
- The server now automatically discovers all your groups
- `TELEGRAM_GROUP_ID` and `TELEGRAM_GROUP_IDS` environment variables are no longer used
- Message results now include `groupId`, `groupTitle`, and `groupType` fields

**Migration Steps:**

1. **Update your `.env` file** (optional):
   - You can remove `TELEGRAM_GROUP_ID` and `TELEGRAM_GROUP_IDS` entries
   - They won't cause errors if left in place, but are no longer used

2. **Update your `opencode.json`** (optional):
   - Remove `TELEGRAM_GROUP_ID` from the environment section
   - Example updated config shown above

3. **No code changes needed**:
   - Auto-discovery works automatically
   - If you want to search specific groups, use the `groupIds` parameter in your search queries

4. **New features to try**:
   - `maxGroups`: Control how many groups to discover (default 50, max 200)
   - `groupTypes`: Filter by group type (channels, supergroups, etc.)
   - `includeChannels`: Toggle channel inclusion
   - `includeArchivedChats`: Include archived chats if needed

**Backward Compatibility:**
- All existing search queries work without changes
- The `groupIds` parameter still works for searching specific groups
- No breaking changes to message result format (only additive fields)

## License

MIT
