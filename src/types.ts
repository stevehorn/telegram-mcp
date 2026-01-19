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

export type SortOrder = 'relevance' | 'date_desc' | 'date_asc';

export type DateShortcut = 'last24h' | 'last7days' | 'last30days' | 'last90days';

export interface MediaInfo {
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'sticker' | 'animation' | 'none';
  filename?: string;
  mimeType?: string;
  size?: number;
  thumbnailUrl?: string;
}

export interface ReplyInfo {
  replyToMessageId: number;
  replyToSenderId?: number;
  replyToSenderName?: string;
  replyToText?: string;
}

export interface ForwardInfo {
  fromChatId?: number;
  fromChatName?: string;
  fromMessageId?: number;
  date?: string;
}

export interface ExtendedMetadata {
  reactions?: Array<{ emoji: string; count: number }>;
  viewCount?: number;
  editDate?: string;
  isPinned?: boolean;
}

export interface SearchResult {
  success: boolean;
  results: MessageResult[];
  totalFound: number;
  hasMore: boolean;
  error?: string;
  sortedBy?: SortOrder;
}

export interface MessageResult {
  messageId: number;
  senderId: number;
  senderName: string;
  senderUsername?: string;
  text: string;
  date: string;
  link?: string;
  relevanceScore?: number;
  media?: MediaInfo;
  replyTo?: ReplyInfo;
  forwardedFrom?: ForwardInfo;
  extended?: ExtendedMetadata;
}

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
  sortBy?: SortOrder;
  startDate?: string;
  endDate?: string;
  dateRange?: DateShortcut;
  includeExtendedMetadata?: boolean;
}
