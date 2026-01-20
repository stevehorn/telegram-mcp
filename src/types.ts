/**
 * Type definitions for the Telegram MCP server
 */

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  phone: string;
  session: string;
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
  // Note: Sender details and text removed to avoid extra API calls
  // Use a separate query to fetch reply message details if needed
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
  partial?: boolean;  // Indicates partial results due to some group failures
  failedGroups?: Array<{ groupId: string; error: string }>;  // Failed groups when partial=true
}

export interface MessageResult {
  messageId: number;
  senderId: number;
  senderName: string;
  senderUsername?: string;
  text: string;
  date: string;
  link?: string;
  groupId: string;  // Group identifier (numeric ID or username)
  groupTitle: string;  // Human-readable group name
  groupType?: string;  // Type: 'channel', 'supergroup', 'gigagroup', 'basicgroup'
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
  groupIds?: string[];  // Optional: Array of specific group IDs to search (overrides auto-discovery)
  maxGroups?: number;  // Max groups to auto-discover (default: 50, max: 200)
  includeChannels?: boolean;  // Include channels in auto-discovery (default: true)
  includeArchivedChats?: boolean;  // Include archived chats (default: false)
  groupTypes?: string[];  // Filter by group types: 'channel', 'supergroup', 'gigagroup', 'basicgroup' (default: all)
  concurrencyLimit?: number;  // Max parallel searches (1-10, default 3)
  rateLimitDelay?: number;  // Delay between requests in ms (default 1000)
}
