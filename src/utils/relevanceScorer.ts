/**
 * Relevance scoring utilities for search results
 * Implements client-side relevance calculation
 */

import type { MessageResult } from '../types.js';

/**
 * Calculate relevance score (0-1) for a message based on search query
 * 
 * Scoring factors:
 * - Exact phrase match: +0.4
 * - First word match: +0.3
 * - Word frequency in message: +0.2
 * - Position of match (earlier = higher): +0.1
 * 
 * @param messageText - The message text to score
 * @param query - The search query
 * @returns Score between 0 and 1
 */
export function calculateRelevance(messageText: string, query: string): number {
  if (!messageText || !query) {
    return 0;
  }

  // Normalize text for comparison
  const normalizedText = messageText.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  let score = 0;

  // Factor 1: Exact phrase match (+0.4)
  if (normalizedText.includes(normalizedQuery)) {
    score += 0.4;

    // Factor 4: Position bonus (earlier = better, up to +0.1)
    const position = normalizedText.indexOf(normalizedQuery);
    const positionScore = (1 - position / normalizedText.length) * 0.1;
    score += positionScore;
  }

  // Split query into words for word-level matching
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
  const textWords = normalizedText.split(/\s+/);

  if (queryWords.length === 0) {
    return score;
  }

  // Factor 2: First word match (+0.3)
  if (textWords.length > 0 && queryWords.some(qw => textWords[0].includes(qw))) {
    score += 0.3;
  }

  // Factor 3: Word frequency (+0.2)
  let matchedWords = 0;
  let totalMatches = 0;

  for (const queryWord of queryWords) {
    let wordMatches = 0;
    for (const textWord of textWords) {
      if (textWord.includes(queryWord)) {
        wordMatches++;
      }
    }
    if (wordMatches > 0) {
      matchedWords++;
      totalMatches += wordMatches;
    }
  }

  // Calculate frequency score based on matched words and total occurrences
  const wordMatchRatio = matchedWords / queryWords.length;
  const frequencyBonus = Math.min(totalMatches / textWords.length, 1);
  score += (wordMatchRatio * 0.15 + frequencyBonus * 0.05);

  // Ensure score is between 0 and 1
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Sort messages by relevance score in descending order
 * 
 * @param messages - Array of message results
 * @returns Sorted array (highest relevance first)
 */
export function sortByRelevance(messages: MessageResult[]): MessageResult[] {
  return messages.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
}
