import { GraphQLClient } from 'graphql-request';

/**
 * GraphQL Endpoint Configuration
 *
 * Sui provides multiple GraphQL endpoints for redundancy:
 * - Beta endpoint: New high-performance GraphQL service (https://graphql.{network}.sui.io)
 * - Legacy endpoint: Original MystenLabs GraphQL service (https://sui-{network}.mystenlabs.com)
 *
 * The beta endpoint is preferred as primary due to better performance and reliability,
 * with legacy endpoint as a proven fallback option.
 */

export interface GraphQLEndpoint {
  url: string;
  name: string;
  timeout: number;
}

/**
 * Get GraphQL endpoints for the current network
 * Priority order: beta (primary) → legacy (fallback)
 */
export function getGraphQLEndpoints(network: string = 'testnet'): GraphQLEndpoint[] {
  const endpoints: GraphQLEndpoint[] = [
    {
      url: `https://graphql.${network}.sui.io/graphql`,
      name: 'beta',
      timeout: 30000, // 30 seconds
    },
    {
      url: `https://sui-${network}.mystenlabs.com/graphql`,
      name: 'legacy',
      timeout: 30000, // 30 seconds
    },
  ];

  // Allow environment variable override for custom GraphQL URL
  // Only use if it's a custom URL (not matching the default pattern)
  const customUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;
  if (customUrl) {
    const isDefault = endpoints.some(e => e.url === customUrl);
    const isDefaultPattern =
      customUrl.includes(`graphql.${network}.sui.io`) ||
      customUrl.includes(`sui-${network}.mystenlabs.com`);

    // Only add as custom if it's truly a non-default URL
    if (!isDefault && !isDefaultPattern) {
      endpoints.unshift({
        url: customUrl,
        name: 'custom',
        timeout: 30000,
      });
    }
  }

  return endpoints;
}

/**
 * Create configured GraphQL clients for all available endpoints
 * Each client has timeout and request headers configured
 *
 * @param network - Sui network (testnet, mainnet, devnet)
 * @returns Array of GraphQLClient instances with endpoint metadata
 */
export function createGraphQLClients(network: string = 'testnet'): Array<{
  client: GraphQLClient;
  endpoint: GraphQLEndpoint;
}> {
  const endpoints = getGraphQLEndpoints(network);

  return endpoints.map(endpoint => ({
    client: new GraphQLClient(endpoint.url, {
      headers: {
        'User-Agent': 'SONAR-Marketplace/1.0',
        'X-Client-Version': '1.0.0',
      },
      // Note: graphql-request doesn't support timeout in constructor
      // Timeout is handled by the underlying fetch implementation
      // For custom timeout, use AbortController with signal
    }),
    endpoint,
  }));
}

/**
 * Create a single GraphQL client for backwards compatibility
 * Uses the first endpoint (highest priority)
 *
 * @param network - Sui network (testnet, mainnet, devnet)
 * @returns Configured GraphQLClient instance
 */
export function createGraphQLClient(network: string = 'testnet'): GraphQLClient {
  const endpoints = getGraphQLEndpoints(network);
  const primaryEndpoint = endpoints[0];

  return new GraphQLClient(primaryEndpoint.url, {
    headers: {
      'User-Agent': 'SONAR-Marketplace/1.0',
      'X-Client-Version': '1.0.0',
    },
    // Note: graphql-request doesn't support timeout in constructor
    // Timeout is handled by the underlying fetch implementation
  });
}
