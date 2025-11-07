import { createClient, RedisClientType } from 'redis';
import { logger } from '../logger';

/**
 * Redis Cache Client
 * Used for caching Walrus blob IDs for Freesound audio
 */
export class RedisCache {
  private client: RedisClientType | null = null;
  private isConnected = false;

  async init(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Too many reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
        },
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis client:', error);
      throw error;
    }
  }

  /**
   * Store Walrus blob ID for a Freesound clip
   */
  async setFreesoundBlobId(freesoundId: number, blobId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    try {
      await this.client.set(`freesound:blob:${freesoundId}`, blobId);
      logger.info(`Cached blob ID for Freesound ${freesoundId}: ${blobId}`);
    } catch (error) {
      logger.error(`Failed to cache blob ID for Freesound ${freesoundId}:`, error);
      throw error;
    }
  }

  /**
   * Get Walrus blob ID for a Freesound clip
   */
  async getFreesoundBlobId(freesoundId: number): Promise<string | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    try {
      const blobId = await this.client.get(`freesound:blob:${freesoundId}`);
      return blobId;
    } catch (error) {
      logger.error(`Failed to get blob ID for Freesound ${freesoundId}:`, error);
      return null;
    }
  }

  /**
   * Check if blob ID exists for a Freesound clip
   */
  async hasFreesoundBlobId(freesoundId: number): Promise<boolean> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    try {
      const exists = await this.client.exists(`freesound:blob:${freesoundId}`);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check blob ID for Freesound ${freesoundId}:`, error);
      return false;
    }
  }

  /**
   * Get all cached Freesound blob IDs
   */
  async getAllFreesoundBlobIds(): Promise<Map<number, string>> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    try {
      const keys = await this.client.keys('freesound:blob:*');
      const result = new Map<number, string>();

      for (const key of keys) {
        const freesoundId = parseInt(key.replace('freesound:blob:', ''), 10);
        const blobId = await this.client.get(key);
        if (blobId && !isNaN(freesoundId)) {
          result.set(freesoundId, blobId);
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get all Freesound blob IDs:', error);
      return new Map();
    }
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Redis client closed');
    }
  }
}

// Export singleton instance
export const redis = new RedisCache();
