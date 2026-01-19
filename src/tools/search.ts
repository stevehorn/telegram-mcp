/**
 * Search tool implementation for Telegram messages
 */

import { Api } from 'telegram/tl/index.js';
import { getClient, resolveGroup, getEntityInfo } from '../telegram.js';
import type { SearchResult, SearchParams, MessageResult, TelegramConfig } from '../types.js';

/**
 * Search for messages in a Telegram group
 */
export async function searchMessages(
  config: TelegramConfig,
  params: SearchParams
): Promise<SearchResult> {
  const { query, limit = 10, offset = 0 } = params;

  try {
    const client = getClient();
    
    // Resolve the group entity
    const group = await resolveGroup(client, config.groupId);
    
    // Search for messages
    const result = await client.invoke(
      new Api.messages.Search({
        peer: group,
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetId: 0,
        addOffset: offset,
        limit: Math.min(limit, 100), // Telegram max is 100
        maxId: 0,
        minId: 0,
        hash: 0 as any,
      })
    );

    if (!('messages' in result)) {
      return {
        success: false,
        results: [],
        totalFound: 0,
        hasMore: false,
        error: 'No messages found',
      };
    }

    const messages = result.messages;
    const totalCount = 'count' in result ? result.count : messages.length;

    // Format the results
    const formattedResults: MessageResult[] = [];

    for (const msg of messages) {
      if (!('message' in msg) || !msg.message) {
        continue;
      }

      const message = msg as Api.Message;
      
      // Get sender info
      let senderName = 'Unknown';
      let senderUsername: string | undefined;
      
      if (message.fromId) {
        if ('userId' in message.fromId) {
          const userId = Number(message.fromId.userId);
          const senderInfo = await getEntityInfo(client, userId);
          senderName = senderInfo.name;
          senderUsername = senderInfo.username;
        } else if ('channelId' in message.fromId) {
          const channelId = Number(message.fromId.channelId);
          const senderInfo = await getEntityInfo(client, channelId);
          senderName = senderInfo.name;
          senderUsername = senderInfo.username;
        }
      }

      // Format date
      const date = new Date(message.date * 1000).toISOString();

      // Try to construct a message link
      let link: string | undefined;
      if ('username' in group && group.username) {
        link = `https://t.me/${group.username}/${message.id}`;
      } else if ('id' in group) {
        // For private groups, use the numeric ID format
        const groupId = String(group.id).replace('-100', '');
        link = `https://t.me/c/${groupId}/${message.id}`;
      }

      formattedResults.push({
        messageId: message.id,
        senderId: message.fromId ? ('userId' in message.fromId ? Number(message.fromId.userId) : ('channelId' in message.fromId ? Number(message.fromId.channelId) : 0)) : 0,
        senderName,
        senderUsername,
        text: message.message || '',
        date,
        link,
      });
    }

    return {
      success: true,
      results: formattedResults,
      totalFound: totalCount,
      hasMore: totalCount > offset + formattedResults.length,
    };
  } catch (error: any) {
    console.error('Search error:', error);
    return {
      success: false,
      results: [],
      totalFound: 0,
      hasMore: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
