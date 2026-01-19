/**
 * Result aggregation utilities for multi-group searches
 */

import type { MessageResult, SearchResult } from '../types.js';

export interface GroupSearchResult extends SearchResult {
  groupId: string;
  executionTime: number;
}

/**
 * Aggregate results from multiple group searches
 */
export class ResultAggregator {
  static combineGroupResults(
    groupResults: GroupSearchResult[],
    globalLimit: number,
    sortBy: 'relevance' | 'date_desc' | 'date_asc' = 'relevance'
  ): SearchResult {
    // Flatten all results and add group identifier
    const allResults: (MessageResult & { groupId: string })[] = [];
    let totalFound = 0;
    let hasMore = false;

    for (const groupResult of groupResults) {
      if (groupResult.success) {
        totalFound += groupResult.totalFound;
        hasMore = hasMore || groupResult.hasMore;

        // Add group ID to each result
        const resultsWithGroup = groupResult.results.map(result => ({
          ...result,
          groupId: groupResult.groupId
        }));

        allResults.push(...resultsWithGroup);
      }
    }

    // Sort globally
    this.sortResults(allResults, sortBy);

    // Apply global limit
    const limitedResults = allResults.slice(0, globalLimit);
    hasMore = hasMore || allResults.length > globalLimit;

    return {
      success: true,
      results: limitedResults,
      totalFound,
      hasMore,
      sortedBy: sortBy
    };
  }

  private static sortResults(
    results: (MessageResult & { groupId: string })[],
    sortBy: 'relevance' | 'date_desc' | 'date_asc'
  ) {
    switch (sortBy) {
      case 'relevance':
        results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        break;
      case 'date_desc':
        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'date_asc':
        results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
    }
  }

  /**
   * Create partial result when some groups fail
   */
  static createPartialResult(
    successfulResults: GroupSearchResult[],
    failedGroups: Array<{ groupId: string; error: any }>,
    params: any
  ): SearchResult {
    const combined = this.combineGroupResults(successfulResults, params.limit || 10, params.sortBy);

    return {
      ...combined,
      partial: true,
      failedGroups: failedGroups.map(f => ({
        groupId: f.groupId,
        error: f.error.message || 'Unknown error'
      }))
    };
  }
}