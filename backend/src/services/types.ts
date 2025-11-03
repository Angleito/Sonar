import type { FastifyBaseLogger } from 'fastify';

export interface RequestMetadata {
  ip: string;
  userAgent?: string;
  logger: FastifyBaseLogger;
}
