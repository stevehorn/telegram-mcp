#!/usr/bin/env node

/**
 * Test search for "retatrutide" specifically
 */

import { config } from 'dotenv';
import { initializeTelegram } from './src/telegram.js';
import { searchMessages } from './src/tools/search.js';
import type { TelegramConfig } from './src/types.js';

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

async function testRetatrutideSearch() {
  try {
    console.log('=== Testing "retatrutide" Search ===\n');
    console.log('Initializing Telegram client...');
    const telegramConfig = getConfig();
    await initializeTelegram(telegramConfig);
    console.log('✓ Connected to Telegram\n');

    console.log('Searching for "retatrutide" with limit=50...\n');
    const startTime = Date.now();
    
    const result = await searchMessages(telegramConfig, {
      query: 'retatrutide',
      limit: 50,
      sortBy: 'relevance'
    });

    const duration = Date.now() - startTime;

    console.log(`\nCompleted in ${duration}ms`);
    console.log(`Success: ${result.success}`);
    console.log(`Total found: ${result.totalFound}`);
    console.log(`Returned: ${result.results.length}`);

    if (result.error) {
      console.log(`Error: ${result.error}`);
    }

    if (result.partial) {
      console.log(`\n⚠️  Partial results:`);
      console.log(`Failed groups: ${result.failedGroups?.length || 0}`);
      if (result.failedGroups) {
        result.failedGroups.forEach(fg => {
          console.log(`  - ${fg.groupId}: ${fg.error}`);
        });
      }
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

    console.log(`\n=== Groups Referenced (${groupMap.size} unique groups) ===`);
    const sortedGroups = Array.from(groupMap.entries())
      .sort((a, b) => b[1].count - a[1].count);

    sortedGroups.forEach(([title, data]) => {
      const isERP = title.toLowerCase().includes('erp');
      const marker = isERP ? ' ⭐ ERP GROUP' : '';
      console.log(`  ${title}: ${data.count} message${data.count !== 1 ? 's' : ''}${marker}`);
    });

    // ERP Check
    const hasERP = result.results.some(msg => 
      msg.groupTitle.toLowerCase().includes('erp')
    );

    console.log(`\n=== ERP Group Status ===`);
    if (hasERP) {
      console.log('✅ ERP Peptide Group Chat Legit IS referenced');
      
      const erpMessages = result.results.filter(msg => 
        msg.groupTitle.toLowerCase().includes('erp')
      );
      
      console.log(`\nMessages from ERP group (${erpMessages.length}):`);
      erpMessages.forEach((msg, i) => {
        console.log(`\n${i + 1}. [${msg.date}] ${msg.senderName}:`);
        console.log(`   "${msg.text.substring(0, 150)}..."`);
        console.log(`   Relevance: ${msg.relevanceScore?.toFixed(2)}`);
      });
    } else {
      console.log('❌ ERP Peptide Group Chat Legit is NOT referenced');
      console.log('\nThis means either:');
      console.log('  1. ERP group has no messages containing "retatrutide"');
      console.log('  2. ERP messages with "retatrutide" have lower relevance than other groups');
      console.log('  3. The 50 result limit excludes ERP messages');
    }

    // Show top 10 results
    console.log('\n=== Top 10 Results ===');
    result.results.slice(0, 10).forEach((msg, i) => {
      console.log(`\n${i + 1}. [${msg.groupTitle}] - Relevance: ${msg.relevanceScore?.toFixed(2)}`);
      console.log(`   ${msg.senderName} (${msg.date})`);
      console.log(`   "${msg.text.substring(0, 100)}..."`);
    });

    // Check if we need to look at more results
    if (!hasERP && result.totalFound > 50) {
      console.log('\n=== Searching with limit=100 to see if ERP appears ===');
      
      const result100 = await searchMessages(telegramConfig, {
        query: 'retatrutide',
        limit: 100,
        sortBy: 'relevance'
      });

      const hasERP100 = result100.results.some(msg => 
        msg.groupTitle.toLowerCase().includes('erp')
      );

      console.log(`ERP found in top 100: ${hasERP100 ? '✅ YES' : '❌ NO'}`);

      if (hasERP100) {
        const erpMessages = result100.results.filter(msg => 
          msg.groupTitle.toLowerCase().includes('erp')
        );
        console.log(`\nERP messages found: ${erpMessages.length}`);
        console.log('These are ranked lower than the top 50 results.');
      }
    }

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testRetatrutideSearch()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
