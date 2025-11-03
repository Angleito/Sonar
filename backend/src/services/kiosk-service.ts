import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../lib/db';
import { syncKioskSnapshotToDatabase } from '../lib/kiosk/state';
import { SONAR_MARKETPLACE_ID } from '../lib/sui/client';
import { HttpError } from '../lib/errors';
import { ErrorCode, type AccessGrant } from '@sonar/shared';
import type { RequestMetadata } from './types';

const KIOSK_SYNC_TTL_MS = 60 * 1000;
const SUI_BASE_UNITS = BigInt(1_000_000_000);
const WALRUS_AGGREGATOR_URL = process.env.WALRUS_AGGREGATOR_URL;

type PrismaKioskClient = Pick<
  PrismaClient,
  | 'kioskReserve'
  | 'priceHistory'
  | 'kioskPurchase'
  | 'dataset'
  | 'accessLog'
>;

function getPrismaClient(client?: PrismaKioskClient | PrismaClient): PrismaClient {
  return (client ?? defaultPrisma) as PrismaClient;
}

async function ensureKioskRecord(
  prisma: PrismaClient,
  logger: RequestMetadata['logger']
) {
  let kiosk = await prisma.kioskReserve.findFirst({
    orderBy: { updated_at: 'desc' },
  });

  const requiresSync =
    SONAR_MARKETPLACE_ID &&
    SONAR_MARKETPLACE_ID !== '0x0' &&
    (!kiosk || Date.now() - kiosk.last_synced_at.getTime() > KIOSK_SYNC_TTL_MS);

  if (requiresSync) {
    logger.debug({ kioskId: kiosk?.id }, 'Refreshing kiosk snapshot from blockchain');
    await syncKioskSnapshotToDatabase(prisma);
    kiosk = await prisma.kioskReserve.findFirst({
      orderBy: { updated_at: 'desc' },
    });
  }

  if (!kiosk) {
    logger.warn('Kiosk reserve missing. Initializing empty snapshot.');
    kiosk = await prisma.kioskReserve.create({
      data: {
        sonar_balance: 0n,
        sui_balance: 0n,
        current_price: SUI_BASE_UNITS,
        current_tier: 1,
        circulating_supply: 0n,
      },
    });
  }

  return kiosk;
}

export async function fetchKioskPrice({
  logger,
  prismaClient,
}: {
  logger: RequestMetadata['logger'];
  prismaClient?: PrismaClient;
}) {
  const prisma = getPrismaClient(prismaClient);
  const kiosk = await ensureKioskRecord(prisma, logger);

  return {
    sonar_price: kiosk.current_price.toString(),
    sui_price: SUI_BASE_UNITS.toString(),
    reserve_balance: {
      sonar: kiosk.sonar_balance.toString(),
      sui: kiosk.sui_balance.toString(),
    },
    current_tier: kiosk.current_tier,
    circulating_supply: kiosk.circulating_supply.toString(),
    price_override: kiosk.price_override ? kiosk.price_override.toString() : null,
    override_active: kiosk.price_override != null,
    last_synced_at: kiosk.last_synced_at.toISOString(),
  };
}

export async function fetchKioskStatus({
  logger,
  prismaClient,
}: {
  logger: RequestMetadata['logger'];
  prismaClient?: PrismaClient;
}) {
  const prisma = getPrismaClient(prismaClient);
  const kiosk = await ensureKioskRecord(prisma, logger);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [priceHistory, sales24h, datasetPurchases] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { timestamp: { gte: oneDayAgo } },
      orderBy: { timestamp: 'asc' },
      take: 100,
    }),
    prisma.kioskPurchase.aggregate({
      where: { timestamp: { gte: oneDayAgo } },
      _sum: { sonar_amount: true },
      _count: { id: true },
    }),
    prisma.kioskPurchase.count({
      where: {
        dataset_id: { not: null },
        timestamp: { gte: oneDayAgo },
      },
    }),
  ]);

  return {
    sonar_reserve: kiosk.sonar_balance.toString(),
    sui_reserve: kiosk.sui_balance.toString(),
    current_tier: kiosk.current_tier,
    circulating_supply: kiosk.circulating_supply.toString(),
    price_override: kiosk.price_override ? kiosk.price_override.toString() : null,
    override_active: kiosk.price_override != null,
    last_synced_at: kiosk.last_synced_at.toISOString(),
    price_trend: priceHistory.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
      price: entry.recorded_price.toString(),
      tier: entry.tier_at_time,
      admin_override: entry.admin_override,
    })),
    last_24h_sales: {
      sonar_sold: (sales24h._sum.sonar_amount || 0n).toString(),
      datasets_purchased: datasetPurchases,
      total_transactions: sales24h._count.id,
    },
  };
}

export async function issueKioskAccessGrant({
  datasetId,
  userAddress,
  metadata,
  prismaClient,
}: {
  datasetId: string;
  userAddress: string;
  metadata: RequestMetadata;
  prismaClient?: PrismaClient;
}): Promise<AccessGrant> {
  const prisma = getPrismaClient(prismaClient);
  const { logger, ip, userAgent } = metadata;

  const purchase = await prisma.kioskPurchase.findFirst({
    where: {
      user_address: userAddress,
      dataset_id: datasetId,
    },
  });

  if (!purchase) {
    logger.warn({ userAddress, datasetId }, 'Kiosk purchase not found for dataset access');

    await prisma.accessLog.create({
      data: {
        user_address: userAddress,
        dataset_id: datasetId,
        action: 'ACCESS_DENIED_NO_PURCHASE',
        ip_address: ip,
        user_agent: userAgent,
      },
    });

    throw new HttpError(403, ErrorCode.UNAUTHORIZED, 'Dataset not purchased via kiosk');
  }

  const dataset = await prisma.dataset.findUnique({
    where: { id: datasetId },
    include: { blobs: true },
  });

  if (!dataset || !dataset.blobs) {
    logger.warn({ datasetId }, 'Dataset blob mapping missing for kiosk grant');
    throw new HttpError(404, ErrorCode.BLOB_NOT_FOUND, 'Dataset not found');
  }

  await prisma.accessLog.create({
    data: {
      user_address: userAddress,
      dataset_id: datasetId,
      action: 'ACCESS_GRANTED',
      ip_address: ip,
      user_agent: userAgent,
    },
  });

  const downloadUrl = WALRUS_AGGREGATOR_URL
    ? `${WALRUS_AGGREGATOR_URL}/blobs/${dataset.blobs.full_blob_id}`
    : `/api/datasets/${datasetId}/stream`;

  logger.info({ userAddress, datasetId }, 'Kiosk access granted');

  return {
    seal_policy_id: dataset.seal_policy_id || '',
    download_url: downloadUrl,
    blob_id: dataset.blobs.full_blob_id,
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
  };
}
