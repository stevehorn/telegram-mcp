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

The server exposes a `search_messages` tool:

**Parameters:**
- `query` (string, required) - Search keyword
- `limit` (number, optional) - Max results (default: 10, max: 100)
- `offset` (number, optional) - Pagination offset (default: 0)

**Example:**
```
Search for "deployment" using the telegram tool
```

## License

MIT
