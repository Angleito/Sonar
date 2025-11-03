/**
 * Seed Kiosk Datasets
 * Populates the database with sample datasets and initializes kiosk state
 * Run with: bun run seed:kiosk
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface SeedDataset {
  title: string;
  creator: string;
  walrus_blob_id: string;
  preview_blob_id: string;
  seal_policy_id: string;
  duration_seconds: number;
  quality_score: number;
  price: number;
  media_type: string;
  languages: string[];
  formats: string[];
  description: string;
}

async function seedKioskDatasets() {
  const prisma = new PrismaClient();

  try {
    console.log('Starting kiosk dataset seed...');

    // Load seed data
    const seedFilePath = resolve(__dirname, '../seed/kiosk-datasets.json');
    const seedDataRaw = readFileSync(seedFilePath, 'utf-8');
    const seedDatasets: SeedDataset[] = JSON.parse(seedDataRaw);

    // Create datasets
    for (const data of seedDatasets) {
      // Generate deterministic ID from title
      const datasetId = `dataset_${Buffer.from(data.title).toString('base64').substring(0, 16)}`;

      console.log(`Creating dataset: ${data.title}`);

      // Upsert dataset (avoid duplicates)
      const dataset = await prisma.dataset.upsert({
        where: { id: datasetId },
        create: {
          id: datasetId,
          creator: data.creator,
          title: data.title,
          description: data.description,
          quality_score: data.quality_score,
          price: BigInt(data.price),
          listed: true,
          duration_seconds: data.duration_seconds,
          media_type: data.media_type,
          languages: data.languages,
          formats: data.formats,
          total_purchases: 0,
          seal_policy_id: data.seal_policy_id,
        },
        update: {
          seal_policy_id: data.seal_policy_id,
        },
      });

      // Create blob mapping
      await prisma.datasetBlob.upsert({
        where: { dataset_id: datasetId },
        create: {
          dataset_id: datasetId,
          full_blob_id: data.walrus_blob_id,
          preview_blob_id: data.preview_blob_id,
        },
        update: {
          full_blob_id: data.walrus_blob_id,
          preview_blob_id: data.preview_blob_id,
        },
      });

      console.log(`  ✓ Created dataset ${datasetId}`);
      console.log(`    Walrus: ${data.walrus_blob_id}`);
    }

    // Initialize kiosk reserve state
    console.log('\nInitializing kiosk reserve...');

    await prisma.kioskReserve.deleteMany({});

    const initialKiosk = await prisma.kioskReserve.create({
      data: {
        id: 'seed-kiosk',
        sonar_balance: BigInt(10_000_000_000_000_000), // 10M SONAR
        sui_balance: BigInt(5_000_000_000_000_000), // 5M SUI
        current_price: BigInt(1_000_000_000), // 1 SUI per SONAR
        price_override: null,
        current_tier: 1,
        circulating_supply: BigInt(70_000_000_000_000_000),
      },
    });

    console.log(`  ✓ Kiosk initialized`);
    console.log(`    SONAR: ${(Number(initialKiosk.sonar_balance) / 1e15).toFixed(0)}M`);
    console.log(`    SUI: ${(Number(initialKiosk.sui_balance) / 1e15).toFixed(0)}M`);
    console.log(`    Price: 1 SUI/SONAR`);

    // Record initial price in history
    await prisma.priceHistory.create({
      data: {
        recorded_price: BigInt(1_000_000_000),
        tier_at_time: 1,
        admin_override: false,
      },
    });

    console.log('\n✅ Kiosk seed complete');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
seedKioskDatasets();
