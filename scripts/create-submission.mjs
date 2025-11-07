#!/usr/bin/env node
/**
 * Create Test Submission - Simple Script
 * Creates a single AudioSubmission on Sui testnet for voting testing
 */

import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { execSync } from 'child_process';

// Updated package ID from voting system deployment
const PACKAGE_ID = '0x300b8182eea252a00d5ff19568126cc20c0bdd19c7e25f6c6953363393d344e6';
const MARKETPLACE_ID = '0xaa422269e77e2197188f9c8e47ffb3faf21c0bafff1d5d04ea9613acc4994bb4';

console.log('📦 Using Package ID:', PACKAGE_ID);

async function main() {
  console.log('🚀 Creating test submission...\n');

  // Get active address from Sui CLI
  const address = execSync('sui client active-address').toString().trim();
  console.log(`👤 Address: ${address}`);

  // Get SONAR coin
  const objectsJson = execSync('sui client objects --json').toString();
  const objects = JSON.parse(objectsJson);
  const sonarCoin = objects.find(obj =>
    obj.data?.type?.includes('SONAR_TOKEN')
  );

  if (!sonarCoin) {
    console.error('❌ No SONAR tokens found');
    process.exit(1);
  }

  console.log(`💎 SONAR Coin: ${sonarCoin.data.objectId}\n`);

  // Export keystore to get private key
  console.log('🔐 Exporting keystore...');
  const keystoreRaw = execSync('sui keytool export --key-identity ' + address).toString();
  const privateKeyMatch = keystoreRaw.match(/suiprivkey1[a-z0-9]+/);

  if (!privateKeyMatch) {
    console.error('❌ Could not extract private key');
    process.exit(1);
  }

  const privateKeyBech32 = privateKeyMatch[0];
  const { schema, secretKey } = decodeSuiPrivateKey(privateKeyBech32);
  const keypair = Ed25519Keypair.fromSecretKey(secretKey);

  // Initialize client
  const client = new SuiClient({ url: 'https://fullnode.testnet.sui.io' });

  // Build transaction
  console.log('📝 Building transaction...');
  const tx = new Transaction();
  tx.setGasBudget(100000000);

  // Split SONAR coin for burn fee (0.001% of circulating supply, using 1000 SONAR to be safe)
  const [burnCoin] = tx.splitCoins(tx.object(sonarCoin.data.objectId), [1000_000_000_000]); // 1000 SONAR

  // Submit audio
  tx.moveCall({
    target: `${PACKAGE_ID}::marketplace::submit_audio`,
    arguments: [
      tx.object(MARKETPLACE_ID),
      burnCoin,
      tx.pure.string('test_blob_' + Date.now()),
      tx.pure.string('test_policy_' + Date.now()),
      tx.pure.option('vector<u8>', null),
      tx.pure.u64(180), // 3 minutes
    ],
  });

  // Execute
  console.log('✍️  Signing and executing...\n');
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  if (result.effects?.status.status === 'success') {
    const created = result.objectChanges?.find(
      change => change.type === 'created' && change.objectType?.includes('AudioSubmission')
    );

    console.log('✅ Success!');
    if (created && 'objectId' in created) {
      console.log(`   Submission ID: ${created.objectId}`);
    }
    console.log(`   Tx: https://suiscan.xyz/testnet/tx/${result.digest}\n`);
  } else {
    console.error('❌ Failed:', result.effects?.status.error);
  }
}

main().catch(console.error);
