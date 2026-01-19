/**
 * Type definitions for the Telegram MCP server
 */

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  phone: string;
  session: string;
  groupId: string;
}

export interface SearchResult {
  success: boolean;
  results: MessageResult[];
  totalFound: number;
  hasMore: boolean;
  error?: string;
}

export interface MessageResult {
  messageId: number;
  senderId: number;
  senderName: string;
  senderUsername?: string;
  text: string;
  date: string;
  link?: string;
}

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
}
