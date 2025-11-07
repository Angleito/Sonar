import { SuiClient } from '@mysten/sui/client';
import { createGraphQLClient, createGraphQLClients } from './graphql-clients';

// Network configuration
export const NETWORK = (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'mainnet' | 'testnet' | 'devnet';

// Separate RPC and GraphQL endpoints
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || `https://fullnode.${NETWORK}.sui.io`;

/**
 * Legacy GRAPHQL_URL export for backwards compatibility
 * New code should use graphqlClients for multi-endpoint support
 */
export const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL || `https://graphql.${NETWORK}.sui.io/graphql`;

// Create Sui client for RPC calls
export const suiClient = new SuiClient({ url: RPC_URL });

/**
 * Single GraphQL client for backwards compatibility
 * Uses the highest priority endpoint (beta by default)
 *
 * @deprecated Use graphqlClients for multi-endpoint resilience
 */
export const graphqlClient = createGraphQLClient(NETWORK);

/**
 * Array of GraphQL clients for multi-endpoint resilience
 * Priority order: beta → legacy → custom (if provided via env)
 * Use this for new code that needs automatic fallback between endpoints
 */
export const graphqlClients = createGraphQLClients(NETWORK);

// Contract addresses (placeholders until deployed)
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '0x0';
export const STATS_OBJECT_ID = process.env.NEXT_PUBLIC_STATS_OBJECT_ID || '0x0';
export const MARKETPLACE_ID = process.env.NEXT_PUBLIC_MARKETPLACE_ID || '0x0';
export const REWARD_POOL_ID = process.env.NEXT_PUBLIC_REWARD_POOL_ID || '0x0';

// Coin type for SONAR token
export const SONAR_COIN_TYPE = `${PACKAGE_ID}::sonar::SONAR`;

// Type definitions for on-chain objects
export const DATASET_TYPE = `${PACKAGE_ID}::marketplace::AudioSubmission`;
export const PROTOCOL_STATS_TYPE = `${PACKAGE_ID}::marketplace::QualityMarketplace`;

// Feature flags
export const USE_BLOCKCHAIN = process.env.NEXT_PUBLIC_USE_BLOCKCHAIN === 'true';

// Explorer URLs
export const getExplorerUrl = (type: 'tx' | 'object' | 'address', id: string) => {
  const baseUrl = NETWORK === 'mainnet'
    ? 'https://suiscan.xyz/mainnet'
    : `https://suiscan.xyz/${NETWORK}`;

  return `${baseUrl}/${type}/${id}`;
};

export const getTxExplorerUrl = (digest: string) => getExplorerUrl('tx', digest);
export const getObjectExplorerUrl = (objectId: string) => getExplorerUrl('object', objectId);
export const getAddressExplorerUrl = (address: string) => getExplorerUrl('address', address);
