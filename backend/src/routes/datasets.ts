/**
 * Dataset API Routes (PostgreSQL-backed)
 * 
 * Fast marketplace queries using pgvector semantic search.
 * Replaces slow blockchain GraphQL queries.
 * 
 * Endpoints:
 * - GET /api/datasets - List all datasets (with filters)
 * - GET /api/datasets/:id - Get single dataset
 * - GET /api/datasets/search - Semantic search
 * - GET /api/datasets/stats - Repository statistics
 *
 * Note: /api/datasets/:id/similar is handled by search.ts
 */

import type { FastifyInstance } from 'fastify';
import { DatasetRepository } from '../services/dataset-repository';
import { fetchDatasetFromBlockchain } from '../services/dataset-service';
import { prisma } from '../lib/db';

const repository = new DatasetRepository();

export async function registerDatasetRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/datasets
   * List datasets with optional filtering
   */
  fastify.get<{
    Querystring: {
      creator?: string;
      languages?: string;
      minQualityScore?: string;
      maxPrice?: string;
      listed?: string;
      cursor?: string;
      limit?: string;
    };
  }>('/api/datasets', async (request, reply) => {
    try {
      const { creator, languages, minQualityScore, maxPrice, listed, cursor, limit } =
        request.query;

      const filter: any = {};

      if (creator) filter.creator = creator;
      if (languages) filter.languages = languages.split(',');
      if (minQualityScore) filter.minQualityScore = parseInt(minQualityScore);
      if (maxPrice) filter.maxPrice = BigInt(maxPrice);
      if (listed !== undefined) filter.listed = listed === 'true';

      // Paginated query
      if (cursor !== undefined || limit !== undefined) {
        filter.cursor = cursor;
        filter.limit = limit ? parseInt(limit) : 20;

        const result = await repository.getDatasetsPaginated(filter);
        return reply.send(result);
      }

      // Non-paginated query
      const datasets = await repository.getDatasets(filter);
      return reply.send({ datasets });
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch datasets');
      return reply.code(500).send({
        error: 'FETCH_FAILED',
        message: 'Failed to fetch datasets',
      });
    }
  });

  /**
   * GET /api/datasets/search
   * Semantic search using pgvector
   */
  fastify.get<{
    Querystring: {
      q: string;
      limit?: string;
      minSimilarity?: string;
    };
  }>('/api/datasets/search', async (request, reply) => {
    try {
      const { q, limit, minSimilarity } = request.query;

      if (!q || q.trim().length === 0) {
        return reply.code(400).send({
          error: 'INVALID_QUERY',
          message: 'Search query is required',
        });
      }

      const results = await repository.semanticSearch(q, {
        limit: limit ? parseInt(limit) : 20,
        minSimilarity: minSimilarity ? parseFloat(minSimilarity) : 0.7,
      });

      return reply.send({ query: q, results });
    } catch (error) {
      request.log.error({ error }, 'Semantic search failed');
      return reply.code(500).send({
        error: 'SEARCH_FAILED',
        message: 'Semantic search failed',
      });
    }
  });

  /**
   * GET /api/datasets/:id
   * Get single dataset (with blockchain fallback + pending metadata)
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/datasets/:id', async (request, reply) => {
    try {
      const { id } = request.params;

      let dataset = await repository.getDataset(id);

      // Fallback: If not in PostgreSQL, try fetching from blockchain
      if (!dataset) {
        request.log.info({ datasetId: id }, 'Dataset not in DB, trying blockchain fallback');

        try {
          const onChainData = await fetchDatasetFromBlockchain(id, request.log);
          if (onChainData) {
            // DEBUG: Log what we're looking for
            request.log.info({
              lookupId: id,
              creatorFromChain: onChainData.creator,
            }, "Looking up pending metadata for dataset");

            // Check for pending metadata with retry loop to handle race condition
            // where POST hasn't committed yet when GET runs
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            let pendingMeta = null;

            for (let attempt = 0; attempt < 3; attempt++) {
              // First try direct lookup by dataset_id (case-insensitive for Sui object IDs)
              pendingMeta = await prisma.pendingMetadata.findFirst({
                where: { dataset_id: { equals: id, mode: 'insensitive' } }
              });

              // DEBUG: Log direct lookup result
              request.log.info({
                attempt,
                directLookupFound: !!pendingMeta,
                directLookupStoredId: pendingMeta?.dataset_id,
                directLookupUserAddress: pendingMeta?.user_address?.slice(0, 20),
                directLookupStatus: pendingMeta?.status,
              }, "Direct lookup result");

              // Fallback: match by creator address for recent uploads from this user
              if (!pendingMeta) {
                pendingMeta = await prisma.pendingMetadata.findFirst({
                  where: {
                    status: { in: ['pending', 'processing'] },
                    user_address: {
                      equals: onChainData.creator,
                      mode: 'insensitive'
                    },
                    created_at: { gte: fiveMinutesAgo }
                  },
                  orderBy: { created_at: 'desc' }
                });

                // DEBUG: Log creator fallback result
                request.log.info({
                  attempt,
                  creatorFallbackFound: !!pendingMeta,
                  creatorFallbackStoredId: pendingMeta?.dataset_id,
                  creatorFallbackUserAddress: pendingMeta?.user_address?.slice(0, 20),
                }, "Creator fallback lookup result");
              }

              if (pendingMeta) {
                request.log.info({ datasetId: id, attempt, foundBy: pendingMeta.dataset_id === id ? 'direct' : 'creator' }, 'Found pending metadata');
                break;
              }

              // Wait briefly for concurrent POST to commit (race condition handling)
              if (attempt < 2) {
                request.log.debug({ datasetId: id, attempt }, 'Pending metadata not found, retrying after delay');
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            if (pendingMeta) {
              request.log.info({ datasetId: id }, 'Found pending metadata, using for dataset creation');
              dataset = await repository.createFromBlockchainWithMetadata(id, onChainData, {
                metadata: pendingMeta.metadata as any,
                verification: pendingMeta.verification as any,
                files: pendingMeta.files as any,
              });

              // Mark pending metadata as completed and update dataset_id
              await prisma.pendingMetadata.update({
                where: { id: pendingMeta.id },
                data: { dataset_id: id, status: 'completed', completed_at: new Date() }
              });
              request.log.info({ datasetId: id }, 'Dataset created with full metadata');
            } else {
              // No pending metadata found yet - return 202 and let frontend retry
              // This handles the race condition where metadata POST hasn't committed yet
              request.log.info({ datasetId: id, creator: onChainData.creator }, 'Dataset on-chain but no metadata yet, returning 202');
              return reply.code(202).send({
                status: 'processing',
                message: 'Dataset is being indexed. Please wait...',
                retryAfter: 2
              });
            }
          }
        } catch (fallbackError) {
          request.log.warn({ datasetId: id, error: fallbackError }, 'Blockchain fallback failed');
        }
      }

      if (!dataset) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Dataset not found',
        });
      }

      return reply.send({ dataset });
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch dataset');
      return reply.code(500).send({
        error: 'FETCH_FAILED',
        message: 'Failed to fetch dataset',
      });
    }
  });

  /**
   * GET /api/datasets/:id/full
   * Get dataset with on-chain data + backend metadata (seal, verification, etc.)
   * Combines blockchain GraphQL data with PostgreSQL stored metadata
   */
  fastify.get<{
    Params: { id: string };
  }>('/api/datasets/:id/full', async (request, reply) => {
    try {
      const { id } = request.params;

      // Fetch backend dataset (includes seal metadata, verification, etc.)
      let backendDataset = await repository.getDataset(id);

      // Fallback: If not in PostgreSQL, try fetching from blockchain
      if (!backendDataset) {
        request.log.info({ datasetId: id }, 'Dataset not in DB, trying blockchain fallback');

        try {
          const onChainData = await fetchDatasetFromBlockchain(id, request.log);
          if (onChainData) {
            // DEBUG: Log what we're looking for
            request.log.info({
              lookupId: id,
              creatorFromChain: onChainData.creator,
            }, "[/full] Looking up pending metadata for dataset");

            // Check for pending metadata with retry loop to handle race condition
            // where POST hasn't committed yet when GET runs
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            let pendingMeta = null;

            for (let attempt = 0; attempt < 3; attempt++) {
              // First try direct lookup by dataset_id (case-insensitive for Sui object IDs)
              pendingMeta = await prisma.pendingMetadata.findFirst({
                where: { dataset_id: { equals: id, mode: 'insensitive' } }
              });

              // DEBUG: Log direct lookup result
              request.log.info({
                attempt,
                directLookupFound: !!pendingMeta,
                directLookupStoredId: pendingMeta?.dataset_id,
              }, "[/full] Direct lookup result");

              // Fallback: match by creator address for recent uploads from this user
              if (!pendingMeta) {
                pendingMeta = await prisma.pendingMetadata.findFirst({
                  where: {
                    status: { in: ['pending', 'processing'] },
                    user_address: {
                      equals: onChainData.creator,
                      mode: 'insensitive'
                    },
                    created_at: { gte: fiveMinutesAgo }
                  },
                  orderBy: { created_at: 'desc' }
                });

                // DEBUG: Log creator fallback result
                request.log.info({
                  attempt,
                  creatorFallbackFound: !!pendingMeta,
                  creatorFallbackStoredId: pendingMeta?.dataset_id,
                }, "[/full] Creator fallback lookup result");
              }

              if (pendingMeta) {
                request.log.info({ datasetId: id, attempt, foundBy: pendingMeta.dataset_id === id ? 'direct' : 'creator' }, 'Found pending metadata');
                break;
              }

              // Wait briefly for concurrent POST to commit (race condition handling)
              if (attempt < 2) {
                request.log.debug({ datasetId: id, attempt }, 'Pending metadata not found, retrying after delay');
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }

            if (pendingMeta) {
              request.log.info({ datasetId: id }, 'Found pending metadata, using for dataset creation');
              backendDataset = await repository.createFromBlockchainWithMetadata(id, onChainData, {
                metadata: pendingMeta.metadata as any,
                verification: pendingMeta.verification as any,
                files: pendingMeta.files as any,
              });

              // Mark pending metadata as completed and update dataset_id
              await prisma.pendingMetadata.update({
                where: { id: pendingMeta.id },
                data: { dataset_id: id, status: 'completed', completed_at: new Date() }
              });
              request.log.info({ datasetId: id }, 'Dataset created with full metadata');
            } else {
              // No pending metadata found yet - return 202 and let frontend retry
              // This handles the race condition where metadata POST hasn't committed yet
              request.log.info({ datasetId: id, creator: onChainData.creator }, 'Dataset on-chain but no metadata yet, returning 202');
              return reply.code(202).send({
                status: 'processing',
                message: 'Dataset is being indexed. Please wait...',
                retryAfter: 2
              });
            }
          }
        } catch (fallbackError) {
          request.log.warn({ datasetId: id, error: fallbackError }, 'Blockchain fallback failed');
        }
      }

      if (!backendDataset) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'Dataset not found',
        });
      }

      return reply.send({
        dataset: backendDataset,
      });
    } catch (error) {
      request.log.error({ error }, 'Failed to fetch full dataset');
      return reply.code(500).send({
        error: 'FETCH_FAILED',
        message: 'Failed to fetch full dataset',
      });
    }
  });

  /**
   * GET /api/datasets/stats
   * Get repository statistics
   */
  fastify.get('/api/datasets/stats', async (request, reply) => {
    try {
      const stats = await repository.getStats();
      return reply.send(stats);
    } catch (error) {
      request.log.error({ error }, 'Failed to get stats');
      return reply.code(500).send({
        error: 'STATS_FAILED',
        message: 'Failed to get statistics',
      });
    }
  });

  fastify.log.info('Dataset routes registered (PostgreSQL-backed)');
}
