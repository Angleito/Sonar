#!/usr/bin/env node
/**
 * Upload Freesound Audio to Walrus CLI Script
 *
 * This script:
 * 1. Fetches 10 audio clips from Freesound.org
 * 2. Downloads each clip's audio file
 * 3. Uploads to Walrus with 20 epochs storage
 * 4. Caches blob IDs in Redis for fast lookup
 *
 * Usage: bun run upload-freesound
 */

import 'dotenv/config';
import { redis } from '../lib/cache/redis-client';
import { logger } from '../lib/logger';

const WALRUS_PUBLISHER_URL =
  process.env.WALRUS_PUBLISHER_URL ||
  'https://publisher.walrus-testnet.walrus.space';

const WALRUS_AGGREGATOR_URL =
  process.env.WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space';

const FREESOUND_API_TOKEN = process.env.FREESOUND_API_TOKEN;
const EPOCHS = 20; // Fixed 20 epochs as per requirements

interface FreeSoundSound {
  id: number;
  name: string;
  previews: Record<string, string>;
}

interface FreeSoundSearchResult {
  results: FreeSoundSound[];
}

/**
 * Search Freesound for audio clips
 */
async function searchFreesound(): Promise<FreeSoundSound[]> {
  if (!FREESOUND_API_TOKEN) {
    throw new Error('FREESOUND_API_TOKEN not set in environment variables');
  }

  const params = new URLSearchParams({
    query: 'human voice',
    page_size: '10',
    fields: 'id,name,previews',
  });

  const url = `https://freesound.org/apiv2/search/text/?${params}`;

  logger.info('Searching Freesound.org for audio clips...');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Token ${FREESOUND_API_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Freesound API error: ${response.statusText}`);
  }

  const data: FreeSoundSearchResult = await response.json();
  logger.info(`Found ${data.results.length} clips from Freesound`);

  return data.results;
}

/**
 * Get best quality preview URL from Freesound sound
 */
function getBestPreviewUrl(previews: Record<string, string>): string | null {
  const priority = ['preview-hq-mp3', 'preview-lq-mp3', 'preview-hq-ogg', 'preview-lq-ogg'];

  for (const key of priority) {
    if (previews[key]) {
      return previews[key];
    }
  }

  // Fallback to any available preview
  return Object.values(previews)[0] || null;
}

/**
 * Download audio from Freesound
 */
async function downloadAudio(url: string): Promise<ArrayBuffer> {
  logger.info(`Downloading audio from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Upload audio buffer to Walrus with epochs
 */
async function uploadToWalrus(
  audioBuffer: ArrayBuffer,
  epochs: number
): Promise<string> {
  const url = `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}`;

  logger.info(`Uploading to Walrus (${epochs} epochs)...`);

  const response = await fetch(url, {
    method: 'PUT',
    body: audioBuffer,
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Walrus upload failed - Status: ${response.status} ${response.statusText}`);
    logger.error(`Response body: ${errorText}`);
    throw new Error(`Walrus upload failed (${response.status}): ${errorText || response.statusText}`);
  }

  const result = await response.json();

  // Extract blob ID from Walrus response
  let blobId: string;
  if (result.newlyCreated) {
    blobId = result.newlyCreated.blobObject.blobId;
  } else if (result.alreadyCertified) {
    blobId = result.alreadyCertified.blobId;
  } else {
    throw new Error('Unexpected Walrus response format');
  }

  return blobId;
}

/**
 * Main upload process
 */
async function main() {
  console.log('\n🎵 SONAR Freesound → Walrus Upload Script\n');
  console.log('═'.repeat(60));

  try {
    // Initialize Redis
    console.log('📡 Connecting to Redis...');
    await redis.init();
    console.log('✅ Redis connected\n');

    // Search Freesound
    const sounds = await searchFreesound();

    if (sounds.length === 0) {
      console.log('⚠️  No sounds found from Freesound');
      process.exit(1);
    }

    console.log(`\n📦 Processing ${sounds.length} audio clips...\n`);

    // Process each sound
    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < sounds.length; i++) {
      const sound = sounds[i];
      console.log(`[${i + 1}/${sounds.length}] ${sound.name} (ID: ${sound.id})`);

      try {
        // Check if already uploaded
        const existingBlobId = await redis.getFreesoundBlobId(sound.id);
        if (existingBlobId) {
          console.log(`  ⏭️  Already cached: ${existingBlobId}`);
          skipCount++;
          continue;
        }

        // Get preview URL
        const previewUrl = getBestPreviewUrl(sound.previews);
        if (!previewUrl) {
          console.log(`  ⚠️  No preview URL available, skipping`);
          continue;
        }

        // Download audio
        const audioBuffer = await downloadAudio(previewUrl);
        console.log(`  📥 Downloaded: ${(audioBuffer.byteLength / 1024).toFixed(2)} KB`);

        // Upload to Walrus
        const blobId = await uploadToWalrus(audioBuffer, EPOCHS);
        console.log(`  ☁️  Walrus blob ID: ${blobId}`);

        // Cache in Redis
        await redis.setFreesoundBlobId(sound.id, blobId);
        console.log(`  ✅ Cached in Redis\n`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      }
    }

    console.log('═'.repeat(60));
    console.log('\n📊 Upload Summary:');
    console.log(`  ✅ Uploaded: ${successCount}`);
    console.log(`  ⏭️  Skipped (already cached): ${skipCount}`);
    console.log(`  ❌ Failed: ${sounds.length - successCount - skipCount}`);
    console.log('\n🎉 Freesound audio uploaded to Walrus!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await redis.close();
  }
}

// Run the script
main();
