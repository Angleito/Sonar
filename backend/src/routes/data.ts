/**
 * Data access routes
 * POST /api/datasets/:id/access - Get access grant for dataset
 * GET /api/datasets/:id/preview - Stream preview (public)
 * GET /api/datasets/:id/stream - Stream full audio (requires ownership)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { assertDatasetId, parseRangeHeader } from '../lib/validators';
import {
  createDatasetAccessGrant,
  getDatasetAudioStream,
  getDatasetPreviewStream,
} from '../services/dataset-service';
import { isHttpError, toErrorResponse } from '../lib/errors';

/**
 * Register data access routes
 */
export async function registerDataRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/datasets/:id/access
   * Get access grant for a dataset (requires JWT auth + ownership)
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/datasets/:id/access',
    {
      onRequest: authMiddleware,
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
        const datasetId = assertDatasetId(request.params.id);
        const userAddress = request.user!.address;

        const grant = await createDatasetAccessGrant({
          datasetId,
          userAddress,
          metadata: {
            ip: request.ip,
            userAgent: Array.isArray(request.headers['user-agent'])
              ? request.headers['user-agent'][0]
              : request.headers['user-agent'],
            logger: request.log,
          },
        });

        return reply.send(grant);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error, datasetId: request.params.id }, 'Access request failed');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /api/datasets/:id/preview
   * Stream preview audio (public, no auth required)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/datasets/:id/preview',
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
        const datasetId = assertDatasetId(request.params.id);
        const walrusResponse = await getDatasetPreviewStream({
          datasetId,
          logger: request.log,
        });

        for (const [key, value] of walrusResponse.headers.entries()) {
          if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
            reply.header(key, value);
          }
        }

        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Cache-Control', 'public, max-age=86400');

        if (!walrusResponse.body) {
          throw new Error('Walrus response missing body');
        }

        request.log.info({ datasetId }, 'Preview stream started');
        return reply
          .status(walrusResponse.status)
          .type('audio/mpeg')
          .send(walrusResponse.body);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error, datasetId: request.params.id }, 'Preview stream failed');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /api/datasets/:id/stream
   * Stream full audio with Range request support (requires ownership)
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/datasets/:id/stream',
    {
      onRequest: authMiddleware,
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
        const datasetId = assertDatasetId(request.params.id);
        const userAddress = request.user!.address;
        const rangeHeader = Array.isArray(request.headers.range)
          ? request.headers.range[0]
          : request.headers.range;
        const range = parseRangeHeader(rangeHeader);

        const walrusResponse = await getDatasetAudioStream({
          datasetId,
          userAddress,
          range,
          metadata: {
            ip: request.ip,
            userAgent: Array.isArray(request.headers['user-agent'])
              ? request.headers['user-agent'][0]
              : request.headers['user-agent'],
            logger: request.log,
          },
        });

        for (const [key, value] of walrusResponse.headers.entries()) {
          if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
            reply.header(key, value);
          }
        }

        reply.header('Content-Type', 'audio/mpeg');
        reply.header('Accept-Ranges', 'bytes');

        if (!walrusResponse.body) {
          throw new Error('Walrus response missing body');
        }

        return reply
          .type('audio/mpeg')
          .status(walrusResponse.status)
          .send(walrusResponse.body);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error, datasetId: request.params.id }, 'Stream failed');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
}
