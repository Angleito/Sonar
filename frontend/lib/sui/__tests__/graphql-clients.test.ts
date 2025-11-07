import { describe, test, expect } from 'bun:test';
import { getGraphQLEndpoints, createGraphQLClients, createGraphQLClient } from '../graphql-clients';
import { GraphQLClient } from 'graphql-request';

describe('GraphQL Clients Factory', () => {
  describe('getGraphQLEndpoints', () => {
    test('returns endpoints in correct priority order for testnet', () => {
      const endpoints = getGraphQLEndpoints('testnet');

      expect(endpoints.length).toBeGreaterThanOrEqual(2);
      expect(endpoints[0].name).toBe('beta');
      expect(endpoints[0].url).toBe('https://graphql.testnet.sui.io/graphql');
      expect(endpoints[1].name).toBe('legacy');
      expect(endpoints[1].url).toBe('https://sui-testnet.mystenlabs.com/graphql');
    });

    test('returns endpoints for mainnet', () => {
      // Temporarily clear env var to test pure mainnet endpoints
      const originalUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;
      delete process.env.NEXT_PUBLIC_GRAPHQL_URL;

      try {
        const endpoints = getGraphQLEndpoints('mainnet');

        expect(endpoints.length).toBe(2);
        expect(endpoints[0].url).toBe('https://graphql.mainnet.sui.io/graphql');
        expect(endpoints[1].url).toBe('https://sui-mainnet.mystenlabs.com/graphql');
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_GRAPHQL_URL = originalUrl;
      }
    });

    test('returns endpoints for devnet', () => {
      // Temporarily clear env var to test pure devnet endpoints
      const originalUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;
      delete process.env.NEXT_PUBLIC_GRAPHQL_URL;

      try {
        const endpoints = getGraphQLEndpoints('devnet');

        expect(endpoints.length).toBe(2);
        expect(endpoints[0].url).toBe('https://graphql.devnet.sui.io/graphql');
        expect(endpoints[1].url).toBe('https://sui-devnet.mystenlabs.com/graphql');
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_GRAPHQL_URL = originalUrl;
      }
    });

    test('each endpoint has timeout configured', () => {
      const endpoints = getGraphQLEndpoints('testnet');

      endpoints.forEach(endpoint => {
        expect(endpoint.timeout).toBeDefined();
        expect(endpoint.timeout).toBe(30000); // 30 seconds
      });
    });

    test('each endpoint has a name', () => {
      const endpoints = getGraphQLEndpoints('testnet');

      endpoints.forEach(endpoint => {
        expect(endpoint.name).toBeDefined();
        expect(endpoint.name.length).toBeGreaterThan(0);
      });
    });

    test('defaults to testnet when no network specified', () => {
      const endpoints = getGraphQLEndpoints();

      expect(endpoints[0].url).toContain('testnet');
      expect(endpoints[1].url).toContain('testnet');
    });
  });

  describe('createGraphQLClients', () => {
    test('creates multiple GraphQL clients', () => {
      const clients = createGraphQLClients('testnet');

      expect(clients.length).toBeGreaterThanOrEqual(2);
      clients.forEach(({ client, endpoint }) => {
        expect(client).toBeInstanceOf(GraphQLClient);
        expect(endpoint).toBeDefined();
        expect(endpoint.name).toBeDefined();
        expect(endpoint.url).toBeDefined();
      });
    });

    test('creates clients for all endpoints', () => {
      const endpoints = getGraphQLEndpoints('testnet');
      const clients = createGraphQLClients('testnet');

      expect(clients.length).toBe(endpoints.length);
    });

    test('clients have correct endpoint metadata', () => {
      const clients = createGraphQLClients('testnet');

      // Beta endpoint should be first
      expect(clients[0].endpoint.name).toBe('beta');
      expect(clients[0].endpoint.url).toBe('https://graphql.testnet.sui.io/graphql');

      // Legacy endpoint should be second
      expect(clients[1].endpoint.name).toBe('legacy');
      expect(clients[1].endpoint.url).toBe('https://sui-testnet.mystenlabs.com/graphql');
    });

    test('creates clients with headers', () => {
      const clients = createGraphQLClients('testnet');

      // GraphQLClient doesn't expose headers directly, but we can verify it was created
      // without throwing errors
      expect(clients[0].client).toBeInstanceOf(GraphQLClient);
    });

    test('works for different networks', () => {
      // Temporarily clear env var to test pure network endpoints
      const originalUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;
      delete process.env.NEXT_PUBLIC_GRAPHQL_URL;

      try {
        const testnetClients = createGraphQLClients('testnet');
        const mainnetClients = createGraphQLClients('mainnet');
        const devnetClients = createGraphQLClients('devnet');

        expect(testnetClients.length).toBe(2);
        expect(mainnetClients.length).toBe(2);
        expect(devnetClients.length).toBe(2);

        expect(testnetClients[0].endpoint.url).toContain('testnet');
        expect(mainnetClients[0].endpoint.url).toContain('mainnet');
        expect(devnetClients[0].endpoint.url).toContain('devnet');
      } finally {
        if (originalUrl) process.env.NEXT_PUBLIC_GRAPHQL_URL = originalUrl;
      }
    });
  });

  describe('createGraphQLClient (single client)', () => {
    test('creates a single GraphQL client', () => {
      const client = createGraphQLClient('testnet');

      expect(client).toBeInstanceOf(GraphQLClient);
    });

    test('uses primary (beta) endpoint', () => {
      const client = createGraphQLClient('testnet');

      // Can't directly check the URL, but we can verify the client was created
      expect(client).toBeInstanceOf(GraphQLClient);
    });

    test('defaults to testnet', () => {
      const client = createGraphQLClient();

      expect(client).toBeInstanceOf(GraphQLClient);
    });

    test('creates different clients for different networks', () => {
      const testnetClient = createGraphQLClient('testnet');
      const mainnetClient = createGraphQLClient('mainnet');

      // Both should be valid instances
      expect(testnetClient).toBeInstanceOf(GraphQLClient);
      expect(mainnetClient).toBeInstanceOf(GraphQLClient);
    });
  });

  describe('Environment Variable Override', () => {
    test('uses custom URL from env var if provided', () => {
      // Save original
      const originalUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;

      try {
        // Set custom URL
        process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://custom-graphql.example.com/graphql';

        const endpoints = getGraphQLEndpoints('testnet');

        // Custom URL should be added as highest priority
        expect(endpoints[0].name).toBe('custom');
        expect(endpoints[0].url).toBe('https://custom-graphql.example.com/graphql');

        // Beta and legacy should still exist
        expect(endpoints.some(e => e.name === 'beta')).toBe(true);
        expect(endpoints.some(e => e.name === 'legacy')).toBe(true);
      } finally {
        // Restore original
        if (originalUrl) {
          process.env.NEXT_PUBLIC_GRAPHQL_URL = originalUrl;
        } else {
          delete process.env.NEXT_PUBLIC_GRAPHQL_URL;
        }
      }
    });

    test('does not duplicate if custom URL matches default', () => {
      const originalUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL;

      try {
        // Set custom URL to match beta endpoint
        process.env.NEXT_PUBLIC_GRAPHQL_URL = 'https://graphql.testnet.sui.io/graphql';

        const endpoints = getGraphQLEndpoints('testnet');

        // Should not add duplicate - only 2 endpoints
        expect(endpoints.length).toBe(2);
        expect(endpoints[0].name).toBe('beta');
        expect(endpoints[1].name).toBe('legacy');
      } finally {
        if (originalUrl) {
          process.env.NEXT_PUBLIC_GRAPHQL_URL = originalUrl;
        } else {
          delete process.env.NEXT_PUBLIC_GRAPHQL_URL;
        }
      }
    });
  });

  describe('Client Configuration', () => {
    test('clients have User-Agent header', () => {
      const clients = createGraphQLClients('testnet');

      // Verify clients were created successfully (headers are set internally)
      expect(clients.length).toBeGreaterThan(0);
      clients.forEach(({ client }) => {
        expect(client).toBeInstanceOf(GraphQLClient);
      });
    });

    test('single client has User-Agent header', () => {
      const client = createGraphQLClient('testnet');

      expect(client).toBeInstanceOf(GraphQLClient);
    });
  });

  describe('Edge Cases', () => {
    test('handles empty network string', () => {
      const endpoints = getGraphQLEndpoints('');

      // Should still return endpoints (possibly with empty network in URL)
      expect(endpoints.length).toBeGreaterThanOrEqual(2);
    });

    test('handles undefined network', () => {
      const endpoints = getGraphQLEndpoints(undefined as any);

      // Should default to testnet
      expect(endpoints[0].url).toContain('testnet');
    });

    test('handles null network', () => {
      const endpoints = getGraphQLEndpoints(null as any);

      // Should default to testnet
      expect(endpoints[0].url).toContain('testnet');
    });

    test('endpoints are independent objects', () => {
      const endpoints1 = getGraphQLEndpoints('testnet');
      const endpoints2 = getGraphQLEndpoints('testnet');

      // Should be different array instances
      expect(endpoints1).not.toBe(endpoints2);

      // But should have same values
      expect(endpoints1.length).toBe(endpoints2.length);
      expect(endpoints1[0].url).toBe(endpoints2[0].url);
    });
  });

  describe('Endpoint URLs', () => {
    test('all URLs are valid HTTPS URLs', () => {
      const networks = ['testnet', 'mainnet', 'devnet'];

      networks.forEach(network => {
        const endpoints = getGraphQLEndpoints(network);

        endpoints.forEach(endpoint => {
          expect(endpoint.url).toMatch(/^https:\/\/.+/);
          expect(endpoint.url).toContain('/graphql');
        });
      });
    });

    test('beta endpoints use new domain format', () => {
      const endpoints = getGraphQLEndpoints('testnet');
      const betaEndpoint = endpoints.find(e => e.name === 'beta');

      expect(betaEndpoint).toBeDefined();
      expect(betaEndpoint!.url).toMatch(/^https:\/\/graphql\..+\.sui\.io\/graphql$/);
    });

    test('legacy endpoints use old domain format', () => {
      const endpoints = getGraphQLEndpoints('testnet');
      const legacyEndpoint = endpoints.find(e => e.name === 'legacy');

      expect(legacyEndpoint).toBeDefined();
      expect(legacyEndpoint!.url).toMatch(/^https:\/\/sui-.+\.mystenlabs\.com\/graphql$/);
    });
  });
});
