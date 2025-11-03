/**
 * Kiosk liquidity routes
 * GET /api/kiosk/price - Get current kiosk price and reserve state
 * GET /api/kiosk/status - Get operational status (24h sales, price history)
 * POST /api/datasets/:id/kiosk-access - Verify purchase and get Walrus URL
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { assertDatasetId } from '../lib/validators';
import { isHttpError, toErrorResponse } from '../lib/errors';
import {
  fetchKioskPrice,
  fetchKioskStatus,
  issueKioskAccessGrant,
} from '../services/kiosk-service';

/**
 * Register kiosk routes
 */
export async function registerKioskRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/kiosk/price
   * Returns current kiosk price and reserve state
   */
  fastify.get<{ Querystring: { cache?: string } }>(
    '/api/kiosk/price',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            cache: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { cache?: string } }>, reply: FastifyReply) => {
      try {
        const price = await fetchKioskPrice({
          logger: request.log,
        });

        return reply.send(price);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error }, 'Failed to get kiosk price');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * GET /api/kiosk/status
   * Returns operational status: reserves, price trend, 24h sales
   */
  fastify.get(
    '/api/kiosk/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const status = await fetchKioskStatus({
          logger: request.log,
        });

        return reply.send(status);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error }, 'Failed to get kiosk status');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  /**
   * POST /api/datasets/:id/kiosk-access
   * Verify user purchased dataset via kiosk, return Walrus blob URL
   * CRITICAL SECURITY: Verify event_signature + dataset_id match before returning URL
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/datasets/:id/kiosk-access',
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
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const datasetId = assertDatasetId(request.params.id);
        const userAddress = request.user!.address;
        const accessGrant = await issueKioskAccessGrant({
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

        return reply.send(accessGrant);
      } catch (error) {
        if (!isHttpError(error)) {
          request.log.error({ error, datasetId: request.params.id }, 'Failed to get kiosk access');
        }

        const { statusCode, body } = toErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );
}
