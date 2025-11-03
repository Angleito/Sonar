import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';
import { prisma as defaultPrisma } from '../lib/db';
import { streamBlobFromWalrus } from '../lib/walrus/client';
import { HttpError } from '../lib/errors';
import { ErrorCode, type AccessGrant } from '@sonar/shared';
import type { ByteRange } from '../lib/validators';
import { verifyUserOwnsDataset as defaultVerifyUserOwnsDataset } from '../lib/sui/queries';
import type { RequestMetadata } from './types';

interface DatasetStreamOptions {
  datasetId: string;
  userAddress: string;
  range?: ByteRange;
  metadata: RequestMetadata;
  prismaClient?: PrismaClient;
  ownershipVerifier?: typeof defaultVerifyUserOwnsDataset;
}

interface AccessGrantOptions {
  datasetId: string;
  userAddress: string;
  metadata: RequestMetadata;
  prismaClient?: PrismaClient;
  ownershipVerifier?: typeof defaultVerifyUserOwnsDataset;
}

interface PreviewOptions {
  datasetId: string;
  logger: FastifyBaseLogger;
  prismaClient?: PrismaClient;
}

type DatasetPrismaClient = Pick<
  PrismaClient,
  'dataset' | 'datasetBlob' | 'purchase' | 'accessLog'
>;

type DatasetQueryResult = NonNullable<
  Awaited<
    ReturnType<
      DatasetPrismaClient['dataset']['findUnique']
    >
  >
>;

interface DatasetWithBlob {
  dataset: DatasetQueryResult;
  blobs: NonNullable<DatasetQueryResult['blobs']>;
}

function getPrismaClient(prismaClient?: DatasetPrismaClient | PrismaClient) {
  return (prismaClient ?? defaultPrisma) as PrismaClient;
}

async function fetchDatasetWithBlobs(
  prismaClient: PrismaClient,
  datasetId: string,
  logger: FastifyBaseLogger
): Promise<DatasetWithBlob> {
  const dataset = await prismaClient.dataset.findUnique({
    where: { id: datasetId },
    include: { blobs: true },
  });

  if (!dataset) {
    logger.warn({ datasetId }, 'Dataset not found');
    throw new HttpError(404, ErrorCode.DATASET_NOT_FOUND, 'Dataset not found.');
  }

  if (!dataset.blobs) {
    logger.error({ datasetId }, 'Dataset blob mapping not found');
    throw new HttpError(404, ErrorCode.BLOB_NOT_FOUND, 'Audio file not found.');
  }

  return { dataset, blobs: dataset.blobs };
}

export async function createDatasetAccessGrant({
  datasetId,
  userAddress,
  metadata,
  prismaClient,
  ownershipVerifier,
}: AccessGrantOptions): Promise<AccessGrant> {
  const prisma = getPrismaClient(prismaClient);
  const { logger, ip, userAgent } = metadata;

  const verifyOwnership = ownershipVerifier ?? defaultVerifyUserOwnsDataset;

  const ownsDataset = await verifyOwnership(
    userAddress,
    datasetId,
    async (address, id) => {
      const purchase = await prisma.purchase.findFirst({
        where: {
          user_address: address,
          dataset_id: id,
        },
      });
      return Boolean(purchase);
    }
  );

  if (!ownsDataset) {
    logger.warn({ userAddress, datasetId }, 'Access denied: purchase required');

    await prisma.accessLog.create({
      data: {
        user_address: userAddress,
        dataset_id: datasetId,
        action: 'ACCESS_DENIED',
        ip_address: ip,
        user_agent: userAgent,
      },
    });

    throw new HttpError(
      403,
      ErrorCode.PURCHASE_REQUIRED,
      'This dataset requires a purchase to access.'
    );
  }

  const { dataset, blobs } = await fetchDatasetWithBlobs(prisma, datasetId, logger);

  await prisma.accessLog.create({
    data: {
      user_address: userAddress,
      dataset_id: datasetId,
      action: 'ACCESS_GRANTED',
      ip_address: ip,
      user_agent: userAgent,
    },
  });

  logger.info({ userAddress, datasetId }, 'Access grant issued');

  const downloadUrl = `/api/datasets/${datasetId}/stream`;

  return {
    seal_policy_id: dataset.seal_policy_id || '',
    download_url: downloadUrl,
    blob_id: blobs.full_blob_id,
    expires_at: Date.now() + 24 * 60 * 60 * 1000,
  };
}

export async function getDatasetPreviewStream({
  datasetId,
  logger,
  prismaClient,
}: PreviewOptions): Promise<Response> {
  const prisma = getPrismaClient(prismaClient);
  const dataset = await fetchDatasetWithBlobs(prisma, datasetId, logger);

  try {
    return await streamBlobFromWalrus(dataset.blobs.preview_blob_id);
  } catch (error) {
    logger.error({ error, datasetId }, 'Failed to stream preview from Walrus');
    throw new HttpError(500, ErrorCode.WALRUS_ERROR, 'Failed to stream preview');
  }
}

export async function getDatasetAudioStream({
  datasetId,
  userAddress,
  range,
  metadata,
  prismaClient,
  ownershipVerifier,
}: DatasetStreamOptions): Promise<Response> {
  const prisma = getPrismaClient(prismaClient);
  const { logger, ip, userAgent } = metadata;

  const verifyOwnership = ownershipVerifier ?? defaultVerifyUserOwnsDataset;

  const ownsDataset = await verifyOwnership(
    userAddress,
    datasetId,
    async (address, id) => {
      const purchase = await prisma.purchase.findFirst({
        where: {
          user_address: address,
          dataset_id: id,
        },
      });
      return Boolean(purchase);
    }
  );

  if (!ownsDataset) {
    logger.warn({ userAddress, datasetId }, 'Streaming access denied: purchase required');

    await prisma.accessLog.create({
      data: {
        user_address: userAddress,
        dataset_id: datasetId,
        action: 'ACCESS_DENIED',
        ip_address: ip,
        user_agent: userAgent,
      },
    });

    throw new HttpError(403, ErrorCode.PURCHASE_REQUIRED, 'Purchase required to stream this dataset');
  }

  const { dataset, blobs } = await fetchDatasetWithBlobs(prisma, datasetId, logger);

  await prisma.accessLog.create({
    data: {
      user_address: userAddress,
      dataset_id: datasetId,
      action: 'STREAM_STARTED',
      ip_address: ip,
      user_agent: userAgent,
    },
  });

  logger.info({ userAddress, datasetId, range }, 'Starting Walrus audio stream');

  try {
    return await streamBlobFromWalrus(blobs.full_blob_id, { range });
  } catch (error) {
    logger.error({ error, datasetId }, 'Failed to stream audio from Walrus');
    throw new HttpError(500, ErrorCode.WALRUS_ERROR, 'Failed to stream audio');
  }
}
