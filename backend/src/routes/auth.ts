/**
 * Authentication routes
 * POST /auth/challenge - Request signing challenge
 * POST /auth/verify - Verify signature and get JWT
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateNonce,
  storeNonce,
  verifyNonce,
} from '../lib/auth/nonce';
import {
  generateToken,
  verifyToken,
} from '../lib/auth/jwt';
import {
  verifyWalletSignature,
  isValidAddress,
} from '../lib/auth/verify';
import {
  createAuthMessage,
  parseAuthMessage,
  isMessageExpired,
} from '@sonar/shared/auth';
import { ErrorCode } from '@sonar/shared';
import type { AuthChallenge, AuthVerifyRequest, AuthToken } from '@sonar/shared';

/**
 * Request body for POST /auth/challenge
 */
interface ChallengeRequest {
  address: string;
}

/**
 * Register auth routes
 */
export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /auth/challenge
   * Request a signing challenge for wallet authentication
   */
  fastify.post<{ Body: ChallengeRequest }>(
    '/auth/challenge',
    async (request: FastifyRequest<{ Body: ChallengeRequest }>, reply: FastifyReply) => {
      try {
        const { address } = request.body;

        // Validate address format
        if (!address || !isValidAddress(address)) {
          request.log.warn({ address }, 'Invalid address format');
          return reply.code(400).send({
            error: ErrorCode.INVALID_REQUEST,
            code: ErrorCode.INVALID_REQUEST,
            message: 'Invalid wallet address format',
          });
        }

        // Generate nonce and message
        const nonce = generateNonce();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
        const message = createAuthMessage(address, nonce, expiresAt);

        // Store nonce for verification
        storeNonce(nonce, 5 * 60 * 1000);

        request.log.info({ address }, 'Challenge requested');

        const response: AuthChallenge = {
          nonce,
          message,
          expiresAt,
        };

        return reply.send(response);
      } catch (error) {
        request.log.error(error, 'Challenge request failed');
        return reply.code(500).send({
          error: ErrorCode.INTERNAL_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to generate challenge',
        });
      }
    }
  );

  /**
   * POST /auth/verify
   * Verify signed message and return JWT token
   */
  fastify.post<{ Body: AuthVerifyRequest }>(
    '/auth/verify',
    async (request: FastifyRequest<{ Body: AuthVerifyRequest }>, reply: FastifyReply) => {
      try {
        const { address, signature, nonce } = request.body;

        // Validate request format
        if (!address || !signature || !nonce) {
          request.log.warn({ address }, 'Missing required fields');
          return reply.code(400).send({
            error: ErrorCode.INVALID_REQUEST,
            code: ErrorCode.INVALID_REQUEST,
            message: 'Missing address, signature, or nonce',
          });
        }

        // Validate address format
        if (!isValidAddress(address)) {
          request.log.warn({ address }, 'Invalid address format');
          return reply.code(400).send({
            error: ErrorCode.INVALID_REQUEST,
            code: ErrorCode.INVALID_REQUEST,
            message: 'Invalid wallet address format',
          });
        }

        // Verify nonce exists and hasn't been used
        if (!verifyNonce(nonce)) {
          request.log.warn({ nonce }, 'Invalid or expired nonce');
          return reply.code(401).send({
            error: ErrorCode.NONCE_INVALID,
            code: ErrorCode.NONCE_INVALID,
            message: 'Invalid or expired nonce. Request a new challenge.',
          });
        }

        // Reconstruct the message from the signature
        // We need to verify the signature and extract the message
        // The frontend signed a message, we need to validate it
        try {
          // Verify the signature
          const isValid = await verifyWalletSignature(address, '', signature);

          if (!isValid) {
            request.log.warn({ address }, 'Invalid signature');
            return reply.code(401).send({
              error: ErrorCode.INVALID_SIGNATURE,
              code: ErrorCode.INVALID_SIGNATURE,
              message: 'Invalid wallet signature',
            });
          }
        } catch (error) {
          request.log.error(error, 'Signature verification failed');
          return reply.code(401).send({
            error: ErrorCode.INVALID_SIGNATURE,
            code: ErrorCode.INVALID_SIGNATURE,
            message: 'Failed to verify signature',
          });
        }

        // Generate JWT token
        const { token, expiresAt } = generateToken(address);

        request.log.info({ address }, 'User authenticated');

        const response: AuthToken = {
          token,
          expiresAt,
        };

        return reply.send(response);
      } catch (error) {
        request.log.error(error, 'Verification failed');
        return reply.code(500).send({
          error: ErrorCode.INTERNAL_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to verify signature',
        });
      }
    }
  );
}
