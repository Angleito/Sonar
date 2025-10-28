import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';

/**
 * Repository interface for data access
 * Abstracts data source (seed data vs. blockchain)
 * Allows seamless switching via environment variable
 */
export interface DataRepository {
  /**
   * Get all datasets with optional filtering
   */
  getDatasets(filter?: DatasetFilter): Promise<Dataset[]>;

  /**
   * Get a single dataset by ID
   */
  getDataset(id: string): Promise<Dataset>;

  /**
   * Get protocol statistics (tier, supply, rates)
   */
  getStats(): Promise<ProtocolStats>;

  /**
   * Get datasets with pagination
   */
  getDatasetsPaginated(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>>;
}

/**
 * Parser helpers for transforming raw data to typed objects
 */
export function parseDataset(raw: any): Dataset {
  return {
    id: raw.id || raw.address,
    creator: raw.creator,
    quality_score: Number(raw.quality_score),
    price: BigInt(raw.price),
    listed: Boolean(raw.listed),
    duration_seconds: Number(raw.duration_seconds),
    languages: raw.languages || [],
    formats: raw.formats || [],
    media_type: raw.media_type,
    created_at: Number(raw.created_at),
    title: raw.title || 'Untitled',
    description: raw.description || '',
    total_purchases: raw.total_purchases ? Number(raw.total_purchases) : 0,
  };
}

export function parseProtocolStats(raw: any): ProtocolStats {
  return {
    circulating_supply: BigInt(raw.circulating_supply),
    current_tier: raw.current_tier as 1 | 2 | 3 | 4,
    burn_rate: Number(raw.burn_rate),
    liquidity_rate: Number(raw.liquidity_rate),
    uploader_rate: Number(raw.uploader_rate),
  };
}
