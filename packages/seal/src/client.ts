/**
 * @sonar/seal - Client Wrapper
 * SealClient wrapper with SONAR-specific defaults
 */

import { SealClient } from '@mysten/seal';
import type { SuiClient } from '@mysten/sui/client';
import type { SealConfig, KeyServerConfig } from './types';
import { ConfigError } from './errors';
import {
  DEFAULT_THRESHOLD,
  DEFAULT_TIMEOUT_MS,
  TESTNET_KEY_SERVERS,
  MAINNET_KEY_SERVERS,
} from './constants';
import { validateThreshold } from './utils';

/**
 * Network type for Sui
 */
export type Network = 'testnet' | 'mainnet' | 'devnet' | 'localnet';

/**
 * Create SealClient with SONAR defaults
 */
export function createSonarSealClient(config: Partial<SealConfig> & {
  suiClient: SuiClient;
  network?: Network;
}): SealClient {
  const {
    suiClient,
    network = 'testnet',
    keyServers,
    threshold = DEFAULT_THRESHOLD,
    verifyServers = true,
    timeout = DEFAULT_TIMEOUT_MS,
  } = config;

  // Get key servers from config or defaults
  let serverConfigs: KeyServerConfig[];

  if (keyServers && keyServers.length > 0) {
    serverConfigs = keyServers;
  } else {
    // Use default servers based on network
    const defaultServers = network === 'mainnet'
      ? MAINNET_KEY_SERVERS
      : TESTNET_KEY_SERVERS;

    if (defaultServers.length === 0) {
      throw new ConfigError(
        `No key servers configured for ${network}. Please set SEAL_SERVER_* environment variables or provide keyServers in config.`
      );
    }

    serverConfigs = defaultServers.map((objectId) => ({
      objectId,
      weight: 1,
    }));
  }

  // Validate threshold
  if (!validateThreshold(threshold, serverConfigs.length)) {
    throw new ConfigError(
      `Invalid threshold: ${threshold}. Must be between 1 and ${serverConfigs.length} (number of key servers).`
    );
  }

  // Validate server configs
  for (const server of serverConfigs) {
    if (!server.objectId || typeof server.objectId !== 'string') {
      throw new ConfigError(`Invalid key server configuration: missing or invalid objectId`);
    }
    if (typeof server.weight !== 'number' || server.weight <= 0) {
      throw new ConfigError(`Invalid key server weight: ${server.weight}`);
    }
  }

  // Create and return SealClient
  return new SealClient({
    suiClient,
    serverConfigs,
    verifyKeyServers: verifyServers,
    timeout,
  });
}

/**
 * Singleton SealClient instance
 * Useful for maintaining a single client across the app
 */
class SealClientSingleton {
  private static instance: SealClient | null = null;
  private static config: Partial<SealConfig> & { suiClient: SuiClient; network?: Network } | null = null;

  /**
   * Get or create singleton instance
   */
  static getInstance(config?: Partial<SealConfig> & { suiClient: SuiClient; network?: Network }): SealClient {
    if (!this.instance) {
      if (!config) {
        throw new ConfigError('SealClient not initialized. Call initialize() first or provide config.');
      }
      this.instance = createSonarSealClient(config);
      this.config = config;
    }
    return this.instance;
  }

  /**
   * Initialize singleton with config
   */
  static initialize(config: Partial<SealConfig> & { suiClient: SuiClient; network?: Network }): SealClient {
    this.instance = createSonarSealClient(config);
    this.config = config;
    return this.instance;
  }

  /**
   * Reset singleton (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.config = null;
  }

  /**
   * Check if initialized
   */
  static isInitialized(): boolean {
    return this.instance !== null;
  }

  /**
   * Get current config
   */
  static getConfig(): (Partial<SealConfig> & { suiClient: SuiClient; network?: Network }) | null {
    return this.config;
  }
}

/**
 * Get singleton SealClient instance
 * Throws if not initialized
 */
export function getSealClient(): SealClient {
  return SealClientSingleton.getInstance();
}

/**
 * Initialize singleton SealClient
 */
export function initializeSealClient(
  config: Partial<SealConfig> & { suiClient: SuiClient; network?: Network }
): SealClient {
  return SealClientSingleton.initialize(config);
}

/**
 * Check if SealClient is initialized
 */
export function isSealClientInitialized(): boolean {
  return SealClientSingleton.isInitialized();
}

/**
 * Reset singleton (useful for testing)
 */
export function resetSealClient(): void {
  SealClientSingleton.reset();
}

/**
 * Get current SealClient config
 */
export function getSealClientConfig(): (Partial<SealConfig> & { suiClient: SuiClient; network?: Network }) | null {
  return SealClientSingleton.getConfig();
}

/**
 * Helper to configure key servers from environment variables
 */
export function getKeyServersFromEnv(network: Network = 'testnet'): KeyServerConfig[] {
  const prefix = network === 'mainnet' ? 'SEAL_SERVER_' : 'SEAL_SERVER_';
  const suffix = network === 'mainnet' ? '_MAINNET' : '_TESTNET';

  const servers: KeyServerConfig[] = [];

  // Try to get up to 5 key servers from env
  for (let i = 1; i <= 5; i++) {
    const varName = `${prefix}${i}${suffix}`;
    const objectId = process.env[varName];

    if (objectId) {
      servers.push({
        objectId,
        weight: 1,
      });
    }
  }

  return servers;
}

/**
 * Create SealClient with environment-based configuration
 */
export function createSealClientFromEnv(
  suiClient: SuiClient,
  network: Network = 'testnet'
): SealClient {
  const keyServers = getKeyServersFromEnv(network);

  if (keyServers.length === 0) {
    throw new ConfigError(
      `No key servers found in environment for ${network}. ` +
      `Please set SEAL_SERVER_1_${network.toUpperCase()}, SEAL_SERVER_2_${network.toUpperCase()}, etc.`
    );
  }

  return createSonarSealClient({
    suiClient,
    network,
    keyServers,
  });
}
