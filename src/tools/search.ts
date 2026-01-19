/**
 * Search tool implementation for Telegram messages
 */

import { Api } from 'telegram/tl/index.js';
import { getClient, resolveGroup, getEntityInfo } from '../telegram.js';
import type { SearchResult, SearchParams, MessageResult, TelegramConfig } from '../types.js';
import { parseDateInput, parseDateShortcut, validateDateRange } from '../utils/dateParser.js';
import { calculateRelevance } from '../utils/relevanceScorer.js';
import { extractMediaInfo } from '../utils/mediaParser.js';

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
    
    // Process date filtering
    let minDate = 0;
    let maxDate = 0;

    if (params.dateRange) {
      const range = parseDateShortcut(params.dateRange);
      minDate = range.start;
      maxDate = range.end;
    }

    // startDate/endDate override dateRange
    if (params.startDate) {
      try {
        minDate = parseDateInput(params.startDate);
      } catch (error: any) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          hasMore: false,
          error: `Invalid startDate: ${error.message}`,
        };
      }
    }
    
    if (params.endDate) {
      try {
        maxDate = parseDateInput(params.endDate);
      } catch (error: any) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          hasMore: false,
          error: `Invalid endDate: ${error.message}`,
        };
      }
    }

    // Validate date range
    if (minDate && maxDate && !validateDateRange(minDate, maxDate)) {
      return {
        success: false,
        results: [],
        totalFound: 0,
        hasMore: false,
        error: 'Invalid date range: startDate must be before endDate',
      };
    }
    
    // Search for messages
    const result = await client.invoke(
      new Api.messages.Search({
        peer: group,
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate,
        maxDate,
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

      // Extract media info
      const media = extractMediaInfo(message);

      // Extract reply information
      let replyTo;
      if (message.replyTo && 'replyToMsgId' in message.replyTo) {
        const replyMsgId = Number(message.replyTo.replyToMsgId);
        
        // Fetch the replied message for context
        try {
          const repliedMsgs = await client.getMessages(group, { ids: [replyMsgId] });
          if (repliedMsgs && repliedMsgs.length > 0 && repliedMsgs[0] && 'message' in repliedMsgs[0]) {
            const replyMessage = repliedMsgs[0] as Api.Message;
            let replyToSenderId: number | undefined;
            let replyToSenderName = 'Unknown';
            
            if (replyMessage.fromId) {
              if ('userId' in replyMessage.fromId) {
                replyToSenderId = Number(replyMessage.fromId.userId);
                const senderInfo = await getEntityInfo(client, replyToSenderId);
                replyToSenderName = senderInfo.name;
              }
            }
            
            replyTo = {
              replyToMessageId: replyMsgId,
              replyToSenderId,
              replyToSenderName,
              replyToText: replyMessage.message?.substring(0, 100),
            };
          }
        } catch (error) {
          // If we can't fetch reply context, just include the ID
          replyTo = {
            replyToMessageId: replyMsgId,
          };
        }
      }

      // Extract forward information
      let forwardedFrom;
      if (message.fwdFrom) {
        const fwd = message.fwdFrom;
        let fromChatName: string | undefined;
        let fromChatId: number | undefined;
        
        if (fwd.fromId) {
          if ('channelId' in fwd.fromId) {
            fromChatId = Number(fwd.fromId.channelId);
            try {
              const chatInfo = await getEntityInfo(client, fromChatId);
              fromChatName = chatInfo.name;
            } catch (error) {
              // Ignore if we can't get chat info
            }
          } else if ('userId' in fwd.fromId) {
            fromChatId = Number(fwd.fromId.userId);
            try {
              const userInfo = await getEntityInfo(client, fromChatId);
              fromChatName = userInfo.name;
            } catch (error) {
              // Ignore if we can't get user info
            }
          }
        }
        
        forwardedFrom = {
          fromChatId,
          fromChatName,
          fromMessageId: fwd.channelPost,
          date: fwd.date ? new Date(fwd.date * 1000).toISOString() : undefined,
        };
      }

      // Extended metadata (only if requested)
      let extended;
      if (params.includeExtendedMetadata) {
        extended = {} as any;
        
        // Reactions
        if (message.reactions && message.reactions.results) {
          extended.reactions = message.reactions.results.map((r: any) => ({
            emoji: r.reaction?.emoticon || '❓',
            count: r.count,
          }));
        }
        
        // View count (for channel messages)
        if (message.views) {
          extended.viewCount = message.views;
        }
        
        // Edit date
        if (message.editDate) {
          extended.editDate = new Date(message.editDate * 1000).toISOString();
        }
        
        // Pinned status
        if (message.pinned) {
          extended.isPinned = true;
        }
      }

      // Calculate relevance score
      const relevanceScore = calculateRelevance(message.message || '', query);

      formattedResults.push({
        messageId: message.id,
        senderId: message.fromId ? ('userId' in message.fromId ? Number(message.fromId.userId) : ('channelId' in message.fromId ? Number(message.fromId.channelId) : 0)) : 0,
        senderName,
        senderUsername,
        text: message.message || '',
        date,
        link,
        relevanceScore,
        media,
        replyTo,
        forwardedFrom,
        extended,
      });
    }

    // Sort results based on sortBy parameter
    const sortBy = params.sortBy || 'relevance';
    if (sortBy === 'relevance') {
      formattedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    } else if (sortBy === 'date_desc') {
      formattedResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'date_asc') {
      formattedResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return {
      success: true,
      results: formattedResults,
      totalFound: totalCount,
      hasMore: totalCount > offset + formattedResults.length,
      sortedBy: sortBy,
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
