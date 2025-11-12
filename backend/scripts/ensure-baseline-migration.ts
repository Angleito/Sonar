import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';

const migrationName = '20241001_initial_schema';

const baselineStatements = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
  `CREATE TABLE IF NOT EXISTS "Dataset" (
    "id" TEXT PRIMARY KEY,
    "creator" TEXT NOT NULL,
    "quality_score" INTEGER NOT NULL,
    "price" BIGINT NOT NULL,
    "listed" BOOLEAN NOT NULL DEFAULT TRUE,
    "duration_seconds" INTEGER NOT NULL,
    "languages" TEXT[] NOT NULL,
    "formats" TEXT[] NOT NULL,
    "media_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "total_purchases" INTEGER NOT NULL DEFAULT 0,
    "seal_policy_id" TEXT,
    "file_count" INTEGER NOT NULL DEFAULT 1,
    "total_duration" INTEGER,
    "bundle_discount_bps" INTEGER
  );`,
  `CREATE INDEX IF NOT EXISTS "Dataset_creator_idx" ON "Dataset" ("creator");`,
  `CREATE INDEX IF NOT EXISTS "Dataset_created_at_idx" ON "Dataset" ("created_at");`,
  `CREATE TABLE IF NOT EXISTS "DatasetBlob" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "dataset_id" TEXT NOT NULL,
    "file_index" INTEGER NOT NULL DEFAULT 0,
    "preview_blob_id" TEXT NOT NULL,
    "full_blob_id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "preview_mime_type" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "seal_policy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DatasetBlob_dataset_id_fkey"
      FOREIGN KEY ("dataset_id") REFERENCES "Dataset" ("id") ON DELETE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "DatasetBlob_dataset_id_file_index_key"
    ON "DatasetBlob" ("dataset_id", "file_index");`,
  `CREATE INDEX IF NOT EXISTS "DatasetBlob_dataset_id_idx"
    ON "DatasetBlob" ("dataset_id");`,
  `CREATE TABLE IF NOT EXISTS "Purchase" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_address" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "price" BIGINT NOT NULL,
    "tx_digest" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchase_type" TEXT NOT NULL DEFAULT 'bundle',
    "file_indices" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    CONSTRAINT "Purchase_dataset_id_fkey"
      FOREIGN KEY ("dataset_id") REFERENCES "Dataset" ("id") ON DELETE CASCADE
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_tx_digest_key"
    ON "Purchase" ("tx_digest");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_user_address_idx"
    ON "Purchase" ("user_address");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_dataset_id_idx"
    ON "Purchase" ("dataset_id");`,
  `CREATE INDEX IF NOT EXISTS "Purchase_timestamp_idx"
    ON "Purchase" ("timestamp");`,
  `CREATE TABLE IF NOT EXISTS "AccessLog" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_address" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccessLog_dataset_id_fkey"
      FOREIGN KEY ("dataset_id") REFERENCES "Dataset" ("id") ON DELETE CASCADE
  );`,
  `CREATE INDEX IF NOT EXISTS "AccessLog_user_address_idx"
    ON "AccessLog" ("user_address");`,
  `CREATE INDEX IF NOT EXISTS "AccessLog_dataset_id_idx"
    ON "AccessLog" ("dataset_id");`,
  `CREATE INDEX IF NOT EXISTS "AccessLog_timestamp_idx"
    ON "AccessLog" ("timestamp");`,
];

async function ensureBaselineApplied() {
  const prisma = new PrismaClient();

  try {
    const tables = await prisma.$queryRaw<Array<{ name: string | null }>>`
      SELECT tablename AS name
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('Dataset', 'DatasetBlob', 'Purchase', 'AccessLog')
    `;

    const expectedTables = ['Dataset', 'DatasetBlob', 'Purchase', 'AccessLog'];
    const missingTables = expectedTables.filter(
      (name) =>
        !tables.some((row) => row.name !== null && row.name.toLowerCase() === name.toLowerCase()),
    );

    if (missingTables.length > 0) {
      console.log(`[migrate] Missing tables detected (${missingTables.join(', ')}); applying baseline schema SQL.`);

      for (const statement of baselineStatements) {
        await prisma.$executeRawUnsafe(statement);
      }

      console.log('[migrate] Baseline schema statements executed successfully.');
    } else {
      console.log('[migrate] Core tables present; baseline schema already exists.');
    }

    const tableCheck = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`SELECT to_regclass('_prisma_migrations') IS NOT NULL AS "exists"`;

    const migrationsTableExists = tableCheck[0]?.exists ?? false;

    if (!migrationsTableExists) {
      console.log(`[migrate] "_prisma_migrations" table missing; Prisma will create it during deploy.`);
      return;
    }

    const applied = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT EXISTS(
        SELECT 1
        FROM "_prisma_migrations"
        WHERE "migration_name" = ${migrationName}
          AND "finished_at" IS NOT NULL
      ) AS "exists"
    `;

    const alreadyApplied = applied[0]?.exists ?? false;

    if (alreadyApplied) {
      console.log(`[migrate] Baseline migration ${migrationName} already recorded. Skipping resolve.`);
      return;
    }

    console.log(`[migrate] Resolving baseline migration ${migrationName} as applied...`);
    execSync(`bunx prisma migrate resolve --applied ${migrationName}`, {
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('[migrate] Failed to ensure baseline migration state:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

ensureBaselineApplied()
  .then(() => {
    console.log('[migrate] Baseline migration check complete.');
  })
  .catch((error) => {
    console.error('[migrate] Baseline migration check failed:', error);
    process.exit(1);
  });

