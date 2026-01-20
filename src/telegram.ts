/**
 * Telegram client initialization and authentication
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl/index.js';
import type { TelegramConfig } from './types.js';

let client: TelegramClient | null = null;

/**
 * Initialize and connect to Telegram
 */
export async function initializeTelegram(config: TelegramConfig): Promise<TelegramClient> {
  if (client && client.connected) {
    return client;
  }

  const session = new StringSession(config.session);
  
  client = new TelegramClient(session, config.apiId, config.apiHash, {
    connectionRetries: 5,
  });

  await client.connect();

  // Check if we're authorized
  if (!await client.isUserAuthorized()) {
    throw new Error(
      'Not authorized. Please run the authentication script first: npm run auth'
    );
  }

  return client;
}

/**
 * Get the Telegram client instance
 */
export function getClient(): TelegramClient {
  if (!client) {
    throw new Error('Telegram client not initialized');
  }
  return client;
}

/**
 * Resolve a group/channel entity from invite link or ID
 */
export async function resolveGroup(client: TelegramClient, groupId: string): Promise<Api.Chat | Api.Channel> {
  try {
    // If it starts with a hash, it's an invite link hash
    if (groupId.startsWith('+') || !groupId.startsWith('-')) {
      // Try to resolve via invite link
      const hash = groupId.replace('+', '');
      try {
        const result = await client.invoke(
          new Api.messages.CheckChatInvite({ hash })
        );
        
        if ('chat' in result) {
          return result.chat as Api.Chat | Api.Channel;
        }
      } catch (error: any) {
        if (error.message?.includes('INVITE_HASH_EXPIRED')) {
          throw new Error('Invite link has expired');
        }
        // If CheckChatInvite fails, try to get dialogs and find the chat
        console.error('Failed to check invite, trying to find in dialogs...', error);
      }
    }

    // Try to get the entity directly
    const entity = await client.getEntity(groupId);
    return entity as Api.Chat | Api.Channel;
  } catch (error: any) {
    throw new Error(`Failed to resolve group: ${error.message}`);
  }
}

/**
 * Get all groups/channels the user belongs to
 */
export async function getAllUserGroups(
  client: TelegramClient,
  options?: {
    maxGroups?: number;
    includeChannels?: boolean;
    includeArchivedChats?: boolean;
    groupTypes?: string[];
  }
): Promise<Array<{ id: string; title: string; type: string }>> {
  try {
    const maxGroups = options?.maxGroups || 50;
    const includeChannels = options?.includeChannels !== false; // Default true
    const includeArchivedChats = options?.includeArchivedChats || false;
    const groupTypes = options?.groupTypes || ['channel', 'supergroup', 'gigagroup', 'basicgroup'];

    const groups: Array<{ id: string; title: string; type: string }> = [];
    let offsetDate = 0;
    let offsetId = 0;
    let offsetPeer: Api.TypeInputPeer = new Api.InputPeerEmpty();

    // Fetch dialogs in batches
    while (groups.length < maxGroups) {
      const result: any = await client.invoke(
        new Api.messages.GetDialogs({
          offsetDate,
          offsetId,
          offsetPeer,
          limit: 100,
          hash: 0 as any,
          excludePinned: false,
          folderId: includeArchivedChats ? undefined : 0,
        })
      );

      if (!('dialogs' in result) || result.dialogs.length === 0) {
        break;
      }

      // Process each dialog
      for (const dialog of result.dialogs) {
        if (groups.length >= maxGroups) {
          break;
        }

        // Find the corresponding peer/chat
        const peerId = dialog.peer;
        let chat: any = null;

        if ('channelId' in peerId) {
          chat = result.chats.find((c: any) => c.id?.equals(peerId.channelId));
        } else if ('chatId' in peerId) {
          chat = result.chats.find((c: any) => c.id?.equals(peerId.chatId));
        }

        if (!chat) continue;

        // Determine the group type
        let groupType = 'unknown';
        if (chat.className === 'Chat') {
          groupType = 'basicgroup';
        } else if (chat.className === 'Channel') {
          if (chat.broadcast) {
            groupType = 'channel';
          } else if (chat.gigagroup) {
            groupType = 'gigagroup';
          } else {
            groupType = 'supergroup';
          }
        }

        // Filter by group type
        if (!groupTypes.includes(groupType)) {
          continue;
        }

        // Skip channels if not included
        if (!includeChannels && groupType === 'channel') {
          continue;
        }

        // Get the group ID
        let groupId: string;
        if ('channelId' in peerId) {
          groupId = `-100${peerId.channelId.toString()}`;
        } else if ('chatId' in peerId) {
          groupId = `-${peerId.chatId.toString()}`;
        } else {
          continue;
        }

        groups.push({
          id: groupId,
          title: chat.title || 'Unknown Group',
          type: groupType,
        });
      }

      // Update pagination parameters
      if (result.dialogs.length > 0) {
        const lastDialog: any = result.dialogs[result.dialogs.length - 1];
        const lastMessage = result.messages.find((m: any) => 
          'id' in m && m.id === lastDialog.topMessage
        );
        
        if (lastMessage && 'date' in lastMessage) {
          offsetDate = lastMessage.date;
          offsetId = lastDialog.topMessage;
          offsetPeer = lastDialog.peer;
        } else {
          break; // No more results
        }
      } else {
        break;
      }

      // If we got fewer dialogs than requested, we've reached the end
      if (result.dialogs.length < 100) {
        break;
      }
    }

    return groups;
  } catch (error: any) {
    throw new Error(`Failed to get user groups: ${error.message}`);
  }
}

/**
 * Disconnect the Telegram client
 */
export async function disconnectTelegram(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
  }
}
