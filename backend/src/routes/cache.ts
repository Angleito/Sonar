/**
 * Cache API routes
 * Provides access to cached Walrus blob IDs for Freesound audio
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../lib/cache/redis-client';
import { toErrorResponse, isHttpError } from '../lib/errors';

/**
 * Register cache routes
 */
export async function registerCacheRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/cache/freesound/:id
   * Get cached Walrus blob ID for a Freesound clip
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/cache/freesound/:id',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const freesoundId = parseInt(request.params.id, 10);

        if (isNaN(freesoundId)) {
          return reply.code(400).send({
            error: 'INVALID_ID',
            message: 'Freesound ID must be a number',
          });
        }

        const blobId = await redis.getFreesoundBlobId(freesoundId);

        if (!blobId) {
          return reply.code(404).send({
            error: 'NOT_CACHED',
            message: `No Walrus blob ID cached for Freesound ${freesoundId}`,
          });
        }

        return reply.send({
          freesoundId,
          blobId,
        });
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error, freesoundId: request.params.id }, 'Cache lookup failed');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /api/cache/freesound
   * Get all cached Walrus blob IDs
   */
  fastify.get(
    '/api/cache/freesound',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const blobIds = await redis.getAllFreesoundBlobIds();

        const result: Record<number, string> = {};
        blobIds.forEach((blobId, freesoundId) => {
          result[freesoundId] = blobId;
        });

        return reply.send({
          count: blobIds.size,
          blobIds: result,
        });
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error }, 'Failed to get all cached blob IDs');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
}
