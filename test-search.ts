#!/usr/bin/env node

/**
 * Test script to verify ERP group appears in search results
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

async function testSearch() {
  try {
    console.log('Initializing Telegram client...');
    const config = getConfig();
    await initializeTelegram(config);
    console.log('✓ Connected to Telegram\n');

    // Test 1: Search for "peptide" across all groups
    console.log('Test 1: Searching for "peptide" across all groups...');
    const searchStartTime = Date.now();
    
    const result = await searchMessages(config, {
      query: 'peptide',
      limit: 50,
      sortBy: 'date_desc'
    });

    const searchDuration = Date.now() - searchStartTime;
    
    console.log(`\nSearch completed in ${searchDuration}ms`);
    console.log(`Success: ${result.success}`);
    console.log(`Total results: ${result.totalFound}`);
    console.log(`Results returned: ${result.results.length}`);
    
    if (result.partial) {
      console.log(`\n⚠️  Partial results (some groups failed):`);
      console.log(`Failed groups: ${result.failedGroups?.length || 0}`);
      if (result.failedGroups) {
        result.failedGroups.forEach(fg => {
          console.log(`  - ${fg.groupId}: ${fg.error}`);
        });
      }
    }

    // Check for ERP group in results
    console.log('\n=== Group Distribution ===');
    const groupMap = new Map<string, number>();
    
    result.results.forEach(msg => {
      const count = groupMap.get(msg.groupTitle) || 0;
      groupMap.set(msg.groupTitle, count + 1);
    });

    const sortedGroups = Array.from(groupMap.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedGroups.forEach(([title, count]) => {
      const erpMarker = title.toLowerCase().includes('erp') ? ' ⭐ ERP GROUP' : '';
      console.log(`  ${title}: ${count} messages${erpMarker}`);
    });

    // Specific check for ERP group
    const hasERP = result.results.some(msg => 
      msg.groupTitle.toLowerCase().includes('erp')
    );

    console.log('\n=== ERP Group Status ===');
    if (hasERP) {
      console.log('✅ SUCCESS: ERP group found in search results!');
      
      const erpMessages = result.results.filter(msg => 
        msg.groupTitle.toLowerCase().includes('erp')
      );
      
      console.log(`\nERP Messages (${erpMessages.length}):`);
      erpMessages.slice(0, 3).forEach(msg => {
        console.log(`  - [${msg.date}] ${msg.senderName}: ${msg.text.substring(0, 80)}...`);
        console.log(`    Group: ${msg.groupTitle} (${msg.groupId})`);
      });
    } else {
      console.log('❌ FAILED: ERP group NOT found in search results');
    }

    // Show sample results
    console.log('\n=== Sample Results ===');
    result.results.slice(0, 5).forEach((msg, i) => {
      console.log(`\n${i + 1}. [${msg.groupTitle}]`);
      console.log(`   From: ${msg.senderName} (@${msg.senderUsername || 'N/A'})`);
      console.log(`   Date: ${msg.date}`);
      console.log(`   Text: ${msg.text.substring(0, 100)}...`);
      console.log(`   Link: ${msg.link || 'N/A'}`);
    });

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testSearch()
  .then(() => {
    console.log('\n✓ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
