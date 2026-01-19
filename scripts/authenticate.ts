#!/usr/bin/env node

/**
 * Authentication script for Telegram
 * Run this once to authenticate and generate a session string
 */

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { config } from 'dotenv';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('=== Telegram Authentication ===\n');

  // Get API credentials
  let apiId = process.env.TELEGRAM_API_ID;
  let apiHash = process.env.TELEGRAM_API_HASH;
  let phone = process.env.TELEGRAM_PHONE;

  if (!apiId) {
    console.log('Get your API credentials from https://my.telegram.org');
    apiId = await question('Enter your API ID: ');
  }

  if (!apiHash) {
    apiHash = await question('Enter your API Hash: ');
  }

  if (!phone) {
    phone = await question('Enter your phone number (with country code, e.g., +1234567890): ');
  }

  const apiIdNum = parseInt(apiId, 10);
  if (isNaN(apiIdNum)) {
    console.error('Invalid API ID');
    rl.close();
    process.exit(1);
  }

  console.log('\nConnecting to Telegram...');

  const session = new StringSession('');
  const client = new TelegramClient(session, apiIdNum, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => phone!,
    password: async () => await question('Enter your 2FA password (if enabled): '),
    phoneCode: async () => await question('Enter the code you received: '),
    onError: (err) => console.error('Error:', err),
  });

  console.log('\n✓ Successfully authenticated!');

  // Get the session string
  const sessionString = client.session.save() as unknown as string;
  console.log('\nYour session string:');
  console.log(sessionString);

  // Try to update .env file
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');

  try {
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } else if (fs.existsSync(envExamplePath)) {
      envContent = fs.readFileSync(envExamplePath, 'utf-8');
    }

    // Update or add environment variables
    const updateVar = (content: string, key: string, value: string): string => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };

    envContent = updateVar(envContent, 'TELEGRAM_API_ID', apiId);
    envContent = updateVar(envContent, 'TELEGRAM_API_HASH', apiHash);
    envContent = updateVar(envContent, 'TELEGRAM_PHONE', phone);
    envContent = updateVar(envContent, 'TELEGRAM_SESSION', sessionString);

    // Ensure TELEGRAM_GROUP_ID exists
    if (!envContent.includes('TELEGRAM_GROUP_ID=')) {
      envContent = updateVar(envContent, 'TELEGRAM_GROUP_ID', '');
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log('\n✓ Updated .env file with your credentials');
  } catch (error) {
    console.error('\n✗ Could not update .env file:', error);
    console.log('\nPlease manually add these to your .env file:');
    console.log(`TELEGRAM_API_ID=${apiId}`);
    console.log(`TELEGRAM_API_HASH=${apiHash}`);
    console.log(`TELEGRAM_PHONE=${phone}`);
    console.log(`TELEGRAM_SESSION=${sessionString}`);
  }

  console.log('\n📝 Next steps:');
  console.log('1. Make sure TELEGRAM_GROUP_ID is set in your .env file');
  console.log('2. Build the project: npm run build');
  console.log('3. Add the MCP server to your opencode.json configuration');
  console.log('4. Start using it in OpenCode!\n');

  await client.disconnect();
  rl.close();
}

main().catch((error) => {
  console.error('Authentication failed:', error);
  rl.close();
  process.exit(1);
});
