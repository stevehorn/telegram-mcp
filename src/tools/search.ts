/**
 * Search tool implementation for Telegram messages
 */

import { Api } from 'telegram/tl/index.js';
import { getClient, resolveGroup, getEntityInfo, getAllUserGroups } from '../telegram.js';
import type { SearchResult, SearchParams, MessageResult, TelegramConfig } from '../types.js';
import { parseDateInput, parseDateShortcut, validateDateRange } from '../utils/dateParser.js';
import { calculateRelevance } from '../utils/relevanceScorer.js';
import { extractMediaInfo } from '../utils/mediaParser.js';
import { TelegramRateLimiter, TelegramCircuitBreaker } from '../utils/rateLimiter.js';
import { ResultAggregator, GroupSearchResult } from '../utils/resultAggregator.js';
import { logOperationError, logger } from '../utils/logger.js';

/**
 * Helper function to determine group type
 */
function determineGroupType(group: any): string {
  if (group.className === 'Chat') return 'basicgroup';
  if (group.className === 'Channel') {
    if (group.broadcast) return 'channel';
    if (group.gigagroup) return 'gigagroup';
    return 'supergroup';
  }
  return 'unknown';
}

/**
 * Search for messages in a single Telegram group
 */
async function searchSingleGroup(
  client: any,
  groupId: string,
  params: SearchParams,
  rateLimiter: TelegramRateLimiter,
  circuitBreaker: TelegramCircuitBreaker
): Promise<GroupSearchResult> {
  const startTime = Date.now();

  try {
    // Resolve the group entity with rate limiting
    const group = await rateLimiter.execute(groupId, async () => {
      return await resolveGroup(client, groupId);
    });

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
          groupId,
          results: [],
          totalFound: 0,
          hasMore: false,
          error: `Invalid startDate: ${error.message}`,
          executionTime: Date.now() - startTime
        };
      }
    }

    if (params.endDate) {
      try {
        maxDate = parseDateInput(params.endDate);
      } catch (error: any) {
        return {
          success: false,
          groupId,
          results: [],
          totalFound: 0,
          hasMore: false,
          error: `Invalid endDate: ${error.message}`,
          executionTime: Date.now() - startTime
        };
      }
    }

    // Validate date range
    if (minDate && maxDate && !validateDateRange(minDate, maxDate)) {
      return {
        success: false,
        groupId,
        results: [],
        totalFound: 0,
        hasMore: false,
        error: 'Invalid date range: startDate must be before endDate',
        executionTime: Date.now() - startTime
      };
    }

    // Search for messages with circuit breaker protection
    const searchResult = await circuitBreaker.execute(async () => {
      return await rateLimiter.execute(groupId, async () => {
        return await client.invoke(
          new Api.messages.Search({
            peer: group,
            q: params.query,
            filter: new Api.InputMessagesFilterEmpty(),
            minDate,
            maxDate,
            offsetId: 0,
            addOffset: params.offset || 0,
            limit: Math.min(params.limit || 10, 100), // Telegram max is 100
            maxId: 0,
            minId: 0,
            hash: 0 as any,
          })
        );
      });
    });

    if (!('messages' in searchResult)) {
      return {
        success: false,
        groupId,
        results: [],
        totalFound: 0,
        hasMore: false,
        error: 'No messages found',
        executionTime: Date.now() - startTime
      };
    }

    const messages = searchResult.messages;
    const totalCount = 'count' in searchResult ? searchResult.count : messages.length;

    // Format the results
    const formattedResults: MessageResult[] = [];

    for (const msg of messages) {
      if (!('message' in msg) || !msg.message) {
        continue;
      }

      const message = msg as Api.Message;

      // Get sender info with caching
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
      const relevanceScore = calculateRelevance(message.message || '', params.query);

      formattedResults.push({
        messageId: message.id,
        senderId: message.fromId ? ('userId' in message.fromId ? Number(message.fromId.userId) : ('channelId' in message.fromId ? Number(message.fromId.channelId) : 0)) : 0,
        senderName,
        senderUsername,
        text: message.message || '',
        date,
        link,
        groupId: groupId,
        groupTitle: group.title || 'Unknown Group',
        groupType: determineGroupType(group),
        relevanceScore,
        media,
        replyTo,
        forwardedFrom,
        extended,
      });
    }

    return {
      success: true,
      groupId,
      results: formattedResults,
      totalFound: totalCount,
      hasMore: totalCount > (params.offset || 0) + formattedResults.length,
      executionTime: Date.now() - startTime
    };
  } catch (error: any) {
    // Log the error
    logOperationError('search_single_group', error, {
      groupId,
      query: params.query,
      executionTime: Date.now() - startTime
    });

    return {
      success: false,
      groupId,
      results: [],
      totalFound: 0,
      hasMore: false,
      error: error.message || 'Unknown error occurred',
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Search for messages in multiple Telegram groups
 */
export async function searchMessages(
  config: TelegramConfig,
  params: SearchParams
): Promise<SearchResult> {
  const startTime = Date.now();

  try {
    const client = getClient();

    // Determine which groups to search
    let groupIds: string[];
    
    if (params.groupIds && params.groupIds.length > 0) {
      // Use specific groups provided in params
      groupIds = params.groupIds;
      logger.info('Using specific groups from parameters', {
        groupCount: groupIds.length,
        groups: groupIds,
        query: params.query
      });
    } else {
      // Auto-discover groups
      logger.info('Starting auto-discovery of user groups', {
        maxGroups: params.maxGroups || 50,
        includeChannels: params.includeChannels !== false,
        includeArchivedChats: params.includeArchivedChats || false,
        groupTypes: params.groupTypes,
        query: params.query
      });

      const discoveredGroups = await getAllUserGroups(client, {
        maxGroups: params.maxGroups || 50,
        includeChannels: params.includeChannels !== false,
        includeArchivedChats: params.includeArchivedChats || false,
        groupTypes: params.groupTypes
      });

      groupIds = discoveredGroups.map(g => g.id);

      logger.info('Auto-discovery completed', {
        groupCount: groupIds.length,
        groups: discoveredGroups.map(g => ({ id: g.id, title: g.title, type: g.type })),
        query: params.query
      });

      // Handle case where no groups were discovered
      if (groupIds.length === 0) {
        return {
          success: false,
          results: [],
          totalFound: 0,
          hasMore: false,
          error: 'No groups found. The user is not a member of any groups.',
        };
      }
    }

    // Set up rate limiting and circuit breaker
    const rateLimiter = new TelegramRateLimiter(params.concurrencyLimit || 3);
    const circuitBreaker = new TelegramCircuitBreaker();

    // Add rate limit delays between requests
    const delayMs = params.rateLimitDelay || 1000;

    // Search all groups in parallel with Promise.allSettled for fault tolerance
    const searchPromises = groupIds.map((groupId: string, index: number) =>
      // Add staggered start to avoid immediate rate limiting
      new Promise<GroupSearchResult>((resolve) => {
        setTimeout(async () => {
          const result = await searchSingleGroup(client, groupId, params, rateLimiter, circuitBreaker);
          resolve(result);
        }, index * delayMs);
      })
    );

    const settledResults = await Promise.allSettled(searchPromises);

    // Separate successful and failed results
    const successfulResults: GroupSearchResult[] = [];
    const failedGroups: Array<{ groupId: string; error: any }> = [];

    settledResults.forEach((result: any, index: number) => {
      if (result.status === 'fulfilled') {
        const groupResult = result.value;
        if (groupResult.success) {
          successfulResults.push(groupResult);
        } else {
          failedGroups.push({
            groupId: groupResult.groupId,
            error: groupResult.error || 'Search failed'
          });
        }
      } else {
        failedGroups.push({
          groupId: groupIds[index],
          error: result.reason
        });
      }
    });

    // Log failed groups
    failedGroups.forEach(failure => {
      logOperationError('multi_group_search', new Error(failure.error), {
        groupId: failure.groupId,
        query: params.query,
        totalExecutionTime: Date.now() - startTime
      });
    });

    // If no groups succeeded, return error
    if (successfulResults.length === 0) {
      return {
        success: false,
        results: [],
        totalFound: 0,
        hasMore: false,
        error: `All ${groupIds.length} group searches failed. Check search_errors.log for details.`,
      };
    }

    // If some groups failed, return partial results
    if (failedGroups.length > 0) {
      return ResultAggregator.createPartialResult(successfulResults, failedGroups, params);
    }

    // All groups succeeded - return combined results
    return ResultAggregator.combineGroupResults(
      successfulResults,
      params.limit || 10,
      params.sortBy || 'relevance'
    );

  } catch (error: any) {
    logOperationError('search_messages', error, {
      query: params.query,
      groupIds: params.groupIds,
      executionTime: Date.now() - startTime
    });

    return {
      success: false,
      results: [],
      totalFound: 0,
      hasMore: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}
