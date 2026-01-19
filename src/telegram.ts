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
 * Get entity info for formatting
 */
export async function getEntityInfo(client: TelegramClient, entityId: number): Promise<{ name: string; username?: string }> {
  try {
    const entity = await client.getEntity(entityId);
    
    if ('firstName' in entity) {
      const firstName = entity.firstName || '';
      const lastName = entity.lastName || '';
      const username = 'username' in entity ? entity.username || undefined : undefined;
      return {
        name: `${firstName} ${lastName}`.trim() || 'Unknown User',
        username,
      };
    } else if ('title' in entity) {
      return {
        name: entity.title || 'Unknown',
        username: 'username' in entity ? entity.username || undefined : undefined,
      };
    }
    
    return { name: 'Unknown' };
  } catch (error) {
    return { name: 'Unknown User' };
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
