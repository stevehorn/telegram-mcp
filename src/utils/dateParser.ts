/**
 * Date parsing utilities for search filters
 * Supports ISO 8601, Unix timestamps, shortcuts, and natural language
 */

import * as chrono from 'chrono-node';
import type { DateShortcut } from '../types.js';

/**
 * Parses various date formats into Unix timestamps (seconds)
 * 
 * Supports:
 * - ISO 8601: "2024-01-15T10:30:00Z"
 * - Unix timestamps: 1705317000 (both seconds and milliseconds)
 * - Natural language: "3 days ago", "last week", "yesterday"
 * 
 * @param input - Date string or number
 * @returns Unix timestamp in seconds
 */
export function parseDateInput(input: string | number): number {
  // If it's already a number, assume it's a timestamp
  if (typeof input === 'number') {
    // If it looks like milliseconds (> year 2100 in seconds), convert to seconds
    return input > 10000000000 ? Math.floor(input / 1000) : input;
  }

  // Try parsing as ISO 8601 / standard date string first
  const standardDate = new Date(input);
  if (!isNaN(standardDate.getTime())) {
    return Math.floor(standardDate.getTime() / 1000);
  }

  // Try natural language parsing with chrono-node
  const parsed = chrono.parseDate(input);
  if (parsed) {
    return Math.floor(parsed.getTime() / 1000);
  }

  throw new Error(`Unable to parse date: ${input}`);
}

/**
 * Converts date shortcuts to Unix timestamp ranges
 * 
 * @param shortcut - Date shortcut (last24h, last7days, etc.)
 * @returns Object with start and end timestamps
 */
export function parseDateShortcut(shortcut: DateShortcut): { start: number; end: number } {
  const now = Math.floor(Date.now() / 1000);
  const secondsPerDay = 86400;

  let startOffset: number;

  switch (shortcut) {
    case 'last24h':
      startOffset = secondsPerDay; // 1 day
      break;
    case 'last7days':
      startOffset = secondsPerDay * 7;
      break;
    case 'last30days':
      startOffset = secondsPerDay * 30;
      break;
    case 'last90days':
      startOffset = secondsPerDay * 90;
      break;
    default:
      throw new Error(`Unknown date shortcut: ${shortcut}`);
  }

  return {
    start: now - startOffset,
    end: now,
  };
}

/**
 * Validates that start date is before end date
 * 
 * @param start - Start timestamp in seconds
 * @param end - End timestamp in seconds
 * @returns true if valid, false otherwise
 */
export function validateDateRange(start: number, end: number): boolean {
  if (start <= 0 || end <= 0) {
    return false;
  }
  return start < end;
}
