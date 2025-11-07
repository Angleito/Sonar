#!/usr/bin/env bun
/**
 * Create Test Submissions Script
 *
 * Creates sample AudioSubmission objects on Sui testnet for testing the voting system.
 * Uses placeholder Walrus/Seal IDs since we just need on-chain objects to vote on.
 *
 * Usage: bun run scripts/create-test-submissions.ts
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';

// Configuration
const NETWORK = 'testnet';
const RPC_URL = 'https://fullnode.testnet.sui.io';
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '0x300b8182eea252a00d5ff19568126cc20c0bdd19c7e25f6c6953363393d344e6';
const MARKETPLACE_ID = process.env.NEXT_PUBLIC_MARKETPLACE_ID || '0xaa422269e77e2197188f9c8e47ffb3faf21c0bafff1d5d04ea9613acc4994bb4';

// Test dataset configurations
const TEST_DATASETS = [
  {
    walrus_blob_id: 'test_blob_conversation_1',
    seal_policy_id: 'test_policy_1',
    duration_seconds: 180,
    title: 'Test: Natural Conversation Sample',
  },
  {
    walrus_blob_id: 'test_blob_dialogue_2',
    seal_policy_id: 'test_policy_2',
    duration_seconds: 240,
    title: 'Test: Customer Service Dialogue',
  },
  {
    walrus_blob_id: 'test_blob_interview_3',
    seal_policy_id: 'test_policy_3',
    duration_seconds: 300,
    title: 'Test: Interview Recording',
  },
];

async function main() {
  console.log('🚀 Creating test submissions on Sui testnet...\n');

  // Check for private key
  const privateKeyBase64 = process.env.SUI_PRIVATE_KEY;
  if (!privateKeyBase64) {
    console.error('❌ Error: SUI_PRIVATE_KEY environment variable not set');
    console.log('\nTo set your private key:');
    console.log('1. Export from Sui wallet (Settings > Export Private Key)');
    console.log('2. Run: export SUI_PRIVATE_KEY="your_base64_private_key"');
    console.log('3. Run this script again\n');
    process.exit(1);
  }

  try {
    // Initialize client and keypair
    const client = new SuiClient({ url: RPC_URL });
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKeyBase64).slice(1));
    const address = keypair.getPublicKey().toSuiAddress();

    console.log(`📍 Network: ${NETWORK}`);
    console.log(`👤 Address: ${address}`);
    console.log(`📦 Package: ${PACKAGE_ID}`);
    console.log(`🏪 Marketplace: ${MARKETPLACE_ID}\n`);

    // Check balance
    const balance = await client.getBalance({ owner: address });
    console.log(`💰 Balance: ${(Number(balance.totalBalance) / 1e9).toFixed(4)} SUI\n`);

    if (Number(balance.totalBalance) < 1e8) {
      console.error('❌ Insufficient balance. Get testnet SUI from:');
      console.log('   https://discord.com/channels/916379725201563759/971488439931392130\n');
      process.exit(1);
    }

    // Get SONAR token balance
    console.log('🔍 Checking SONAR token balance...');
    const sonarCoins = await client.getCoins({
      owner: address,
      coinType: `${PACKAGE_ID}::sonar_token::SONAR_TOKEN`,
    });

    if (sonarCoins.data.length === 0) {
      console.error('❌ No SONAR tokens found. You need SONAR tokens to pay the burn fee.');
      console.log('   Mint some tokens first or contact the team for testnet tokens.\n');
      process.exit(1);
    }

    const totalSonar = sonarCoins.data.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
    console.log(`💎 SONAR Balance: ${Number(totalSonar) / 1e9} SONAR\n`);

    // Create submissions
    console.log(`📝 Creating ${TEST_DATASETS.length} test submissions...\n`);

    for (const [index, dataset] of TEST_DATASETS.entries()) {
      console.log(`Creating submission ${index + 1}/${TEST_DATASETS.length}: "${dataset.title}"`);

      const tx = new Transaction();
      tx.setGasBudget(100000000); // 0.1 SUI

      // Get a SONAR coin for burn fee (using smallest available)
      const sonarCoin = sonarCoins.data.sort((a, b) => Number(BigInt(a.balance) - BigInt(b.balance)))[0];
      const burnFee = 1000000; // 0.001 SONAR

      // Split coins for burn fee
      const [burnCoin] = tx.splitCoins(tx.object(sonarCoin.coinObjectId), [burnFee]);

      // Call submit_audio
      tx.moveCall({
        target: `${PACKAGE_ID}::marketplace::submit_audio`,
        arguments: [
          tx.object(MARKETPLACE_ID),
          burnCoin,
          tx.pure.string(dataset.walrus_blob_id),
          tx.pure.string(dataset.seal_policy_id),
          tx.pure.option('vector<u8>', null), // No preview hash
          tx.pure.u64(dataset.duration_seconds),
        ],
      });

      try {
        // Sign and execute
        const result = await client.signAndExecuteTransaction({
          transaction: tx,
          signer: keypair,
          options: {
            showEffects: true,
            showObjectChanges: true,
          },
        });

        if (result.effects?.status.status === 'success') {
          // Find created AudioSubmission object
          const created = result.objectChanges?.find(
            (change) => change.type === 'created' && change.objectType?.includes('AudioSubmission')
          );

          console.log(`  ✅ Success!`);
          if (created && 'objectId' in created) {
            console.log(`     Submission ID: ${created.objectId}`);
          }
          console.log(`     Tx: https://suiscan.xyz/testnet/tx/${result.digest}\n`);
        } else {
          console.log(`  ❌ Failed: ${result.effects?.status.error}\n`);
        }

        // Wait a bit between submissions
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`  ❌ Error:`, error instanceof Error ? error.message : error);
        console.log();
      }
    }

    console.log('✨ Done! Test submissions created.');
    console.log('\n📍 Visit http://localhost:3000/marketplace-testnet to see them!\n');
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
