/**
 * Media parsing utilities for extracting media information from Telegram messages
 */

import { Api } from 'telegram/tl/index.js';
import type { MediaInfo } from '../types.js';

/**
 * Extract media information from a Telegram message
 * 
 * @param message - Telegram message object
 * @returns MediaInfo object or undefined if no media
 */
export function extractMediaInfo(message: Api.Message): MediaInfo | undefined {
  if (!message.media) {
    return undefined;
  }

  const media = message.media;

  // Photo
  if (media instanceof Api.MessageMediaPhoto) {
    return {
      type: 'photo',
      size: media.photo && 'sizes' in media.photo ? getSizeFromPhoto(media.photo) : undefined,
    };
  }

  // Document (videos, files, audio, voice, stickers, animations)
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (doc && 'mimeType' in doc) {
      const mimeType = doc.mimeType || '';
      const size = 'size' in doc ? Number(doc.size) : undefined;
      
      // Extract filename from attributes
      let filename: string | undefined;
      if ('attributes' in doc && doc.attributes) {
        for (const attr of doc.attributes) {
          if (attr instanceof Api.DocumentAttributeFilename) {
            filename = attr.fileName;
            break;
          }
        }
      }

      // Determine specific type based on attributes and mime type
      if ('attributes' in doc && doc.attributes) {
        for (const attr of doc.attributes) {
          if (attr instanceof Api.DocumentAttributeVideo) {
            return {
              type: 'video',
              filename,
              mimeType,
              size,
            };
          }
          if (attr instanceof Api.DocumentAttributeAudio) {
            if ('voice' in attr && attr.voice) {
              return {
                type: 'voice',
                filename,
                mimeType,
                size,
              };
            }
            return {
              type: 'audio',
              filename,
              mimeType,
              size,
            };
          }
          if (attr instanceof Api.DocumentAttributeSticker) {
            return {
              type: 'sticker',
              filename,
              mimeType,
              size,
            };
          }
          if (attr instanceof Api.DocumentAttributeAnimated) {
            return {
              type: 'animation',
              filename,
              mimeType,
              size,
            };
          }
        }
      }

      // Default to document if no specific type found
      return {
        type: 'document',
        filename,
        mimeType,
        size,
      };
    }
  }

  // If we have media but couldn't parse it, return none type
  return {
    type: 'none',
  };
}

/**
 * Helper function to estimate size from photo sizes array
 */
function getSizeFromPhoto(photo: any): number | undefined {
  if (!('sizes' in photo) || !photo.sizes) {
    return undefined;
  }

  // Try to find the largest size
  for (const size of photo.sizes) {
    if ('size' in size && typeof size.size === 'number') {
      return size.size;
    }
  }

  return undefined;
}
