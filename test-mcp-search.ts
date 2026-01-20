#!/usr/bin/env node

/**
 * Test script that simulates MCP tool behavior
 */

import { config } from 'dotenv';
import { initializeTelegram } from './src/telegram.js';
import { searchMessages } from './src/tools/search.js';
import type { TelegramConfig, SearchParams } from './src/types.js';

// Load environment variables
config();

// Get configuration
function getConfig(): TelegramConfig {
  const apiId = process.env.TELEGRAM_API_ID;
  const apiHash = process.env.TELEGRAM_API_HASH;
  const phone = process.env.TELEGRAM_PHONE;
  const session = process.env.TELEGRAM_SESSION || '';

  if (!apiId || !apiHash || !phone) {
    throw new Error(
      'Missing required environment variables. Please check your .env file.\n' +
      'Required: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE'
    );
  }

  return {
    apiId: parseInt(apiId, 10),
    apiHash,
    phone,
    session,
  };
}

async function testMCPSearch() {
  try {
    console.log('=== Simulating MCP Tool Call ===\n');
    console.log('Initializing Telegram client...');
    const telegramConfig = getConfig();
    await initializeTelegram(telegramConfig);
    console.log('✓ Connected to Telegram\n');

    // Test with various parameter combinations that MCP might use
    const tests = [
      {
        name: 'Default MCP call (limit=10)',
        params: { query: 'peptide', limit: 10 } as SearchParams
      },
      {
        name: 'MCP with limit=20',
        params: { query: 'peptide', limit: 20 } as SearchParams
      },
      {
        name: 'MCP with limit=50, sortBy=relevance',
        params: { query: 'peptide', limit: 50, sortBy: 'relevance' as const } as SearchParams
      },
      {
        name: 'MCP with limit=100, sortBy=date_desc',
        params: { query: 'peptide', limit: 100, sortBy: 'date_desc' as const } as SearchParams
      }
    ];

    for (const test of tests) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Test: ${test.name}`);
      console.log(`Parameters: ${JSON.stringify(test.params)}`);
      console.log('='.repeat(60));
      
      const startTime = Date.now();
      const result = await searchMessages(telegramConfig, test.params);
      const duration = Date.now() - startTime;

      console.log(`\nCompleted in ${duration}ms`);
      console.log(`Success: ${result.success}`);
      console.log(`Total found: ${result.totalFound}`);
      console.log(`Returned: ${result.results.length}`);
      
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }

      if (result.partial) {
        console.log(`⚠️  Partial results - ${result.failedGroups?.length || 0} groups failed`);
      }

      // Analyze groups
      const groupMap = new Map<string, { count: number; messages: any[] }>();
      result.results.forEach(msg => {
        if (!groupMap.has(msg.groupTitle)) {
          groupMap.set(msg.groupTitle, { count: 0, messages: [] });
        }
        const group = groupMap.get(msg.groupTitle)!;
        group.count++;
        group.messages.push(msg);
      });

      console.log(`\nGroups in results (${groupMap.size} unique):`);
      const sortedGroups = Array.from(groupMap.entries())
        .sort((a, b) => b[1].count - a[1].count);

      sortedGroups.forEach(([title, data]) => {
        const isERP = title.toLowerCase().includes('erp');
        const marker = isERP ? ' ⭐ ERP!' : '';
        console.log(`  ${title}: ${data.count}${marker}`);
        
        if (isERP) {
          console.log(`    Group ID: ${data.messages[0].groupId}`);
          console.log(`    Sample message: "${data.messages[0].text.substring(0, 60)}..."`);
        }
      });

      // ERP Check
      const hasERP = result.results.some(msg => 
        msg.groupTitle.toLowerCase().includes('erp')
      );

      console.log(`\n${hasERP ? '✅' : '❌'} ERP Group ${hasERP ? 'FOUND' : 'NOT FOUND'}`);

      if (!hasERP) {
        console.log('\n⚠️  ERP NOT IN RESULTS - Debugging:');
        console.log(`   Total results: ${result.results.length}`);
        console.log(`   Unique groups: ${groupMap.size}`);
        console.log(`   Sort order: ${test.params.sortBy || 'relevance (default)'}`);
        
        // Show all groups with their top relevance/date
        console.log('\n   All groups in result set:');
        sortedGroups.forEach(([title, data]) => {
          const firstMsg = data.messages[0];
          console.log(`     - ${title}`);
          console.log(`       Messages: ${data.count}`);
          console.log(`       Relevance: ${firstMsg.relevanceScore?.toFixed(2) || 'N/A'}`);
          console.log(`       Latest: ${firstMsg.date}`);
        });
      }

      // Wait a bit between tests to avoid rate limiting
      if (test !== tests[tests.length - 1]) {
        console.log('\nWaiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testMCPSearch()
  .then(() => {
    console.log('\n\n=== All Tests Completed ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
