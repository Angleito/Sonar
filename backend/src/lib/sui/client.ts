/**
 * Sui blockchain client using Dreamlit's walrus-sui-core SDK.
 * Provides transaction management with queueing, tracking, and retry logic.
 * Uses suiService for production-ready blockchain interactions with built-in
 * query executor for rate limiting and error handling.
 */

import { SuiClient } from '@mysten/sui.js/client';
import { suiService } from '@dreamlit/walrus-sui-core/node';
import { logger } from '../logger';
import { config } from '../config';

// Export configuration constants from centralized config
export const SUI_RPC_URL = config.sui.rpcUrl;
export const SONAR_PACKAGE_ID = config.sui.packageId;
export const SONAR_MARKETPLACE_ID = config.sui.marketplaceId;

// Initialize Dreamlit's suiService with SuiClient
// The suiService provides transaction management, queueing, and retry logic
logger.info({ rpcUrl: SUI_RPC_URL }, 'Initializing Dreamlit Sui service');
suiService.client = new SuiClient({ url: SUI_RPC_URL });

// Export suiService components for use throughout the application
// suiClient: Direct access to SuiClient for queries
// suiQueryExecutor: Managed query executor with rate limiting and retries
export const suiClient = suiService.client;
export const suiQueryExecutor = suiService.queryExecutor;

// Validation warnings are now handled in centralized config

logger.info(
  {
    packageId: SONAR_PACKAGE_ID,
    marketplaceId: SONAR_MARKETPLACE_ID,
  },
  'Sui client initialized with Dreamlit SDK'
);
