/**
 * Leaderboard routes
 * GET /api/leaderboard - Global rankings with optional filtering
 * GET /api/leaderboard/user/:walletAddress - User's rank and tier progress
 * GET /api/leaderboard/search - Search users
 * GET /api/leaderboard/tiers - Tier distribution
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getGlobalLeaderboard,
  getUserRankInfo,
  searchLeaderboard,
  getTierDistribution,
} from '../services/leaderboard-service';

interface LeaderboardQuery {
  limit?: string;
  offset?: string;
  tier?: string;
}

interface SearchQuery {
  q?: string;
  limit?: string;
}

/**
 * Register leaderboard routes
 */
export async function registerLeaderboardRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/leaderboard
   * Global leaderboard with optional tier filter and pagination
   */
  fastify.get<{ Querystring: LeaderboardQuery }>(
    '/api/leaderboard',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', default: '100' },
            offset: { type: 'string', default: '0' },
            tier: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: LeaderboardQuery }>, reply: FastifyReply) => {
      try {
        const limit = Math.min(parseInt(request.query.limit || '100', 10), 500);
        const offset = Math.max(parseInt(request.query.offset || '0', 10), 0);
        const tier = request.query.tier;

        const leaderboard = await getGlobalLeaderboard(limit, offset, tier);

        return reply.send(leaderboard);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'LEADERBOARD_ERROR',
          message: 'Failed to fetch leaderboard',
        });
      }
    }
  );

  /**
   * GET /api/leaderboard/user/:walletAddress
   * Get user's ranking and tier progress
   */
  fastify.get<{ Params: { walletAddress: string } }>(
    '/api/leaderboard/user/:walletAddress',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            walletAddress: { type: 'string' },
          },
          required: ['walletAddress'],
        },
      },
    },
    async (request: FastifyRequest<{ Params: { walletAddress: string } }>, reply: FastifyReply) => {
      try {
        const walletAddress = request.params.walletAddress;

        const userRank = await getUserRankInfo(walletAddress);

        if (!userRank) {
          return reply.code(404).send({
            error: 'USER_NOT_FOUND',
            message: 'User not found in leaderboard',
          });
        }

        return reply.send(userRank);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'LEADERBOARD_ERROR',
          message: 'Failed to fetch user rank',
        });
      }
    }
  );

  /**
   * GET /api/leaderboard/search
   * Search users by username or wallet address
   */
  fastify.get<{ Querystring: SearchQuery }>(
    '/api/leaderboard/search',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            limit: { type: 'string', default: '20' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: SearchQuery }>, reply: FastifyReply) => {
      try {
        const query = request.query.q;
        const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

        if (!query || query.trim().length === 0) {
          return reply.code(400).send({
            error: 'INVALID_QUERY',
            message: 'Search query is required',
          });
        }

        const results = await searchLeaderboard(query, limit);

        return reply.send(results);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'SEARCH_ERROR',
          message: 'Failed to search leaderboard',
        });
      }
    }
  );

  /**
   * GET /api/leaderboard/tiers
   * Get distribution of users across tiers
   */
  fastify.get(
    '/api/leaderboard/tiers',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const distribution = await getTierDistribution();

        return reply.send(distribution);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          error: 'LEADERBOARD_ERROR',
          message: 'Failed to fetch tier distribution',
        });
      }
    }
  );
}
