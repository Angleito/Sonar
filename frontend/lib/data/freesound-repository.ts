import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';
import { DataRepository, parseDataset } from './repository';

interface ApiDatasetResponse {
  data: ApiDataset[];
  cursor?: string;
  hasMore: boolean;
  total: number;
  error?: string;
}

interface ApiDataset {
  id: string;
  title: string;
  description: string;
  creator: string;
  duration: number;
  tags: string[];
  previews: Record<string, string>;
  createdAt: string;
  avgRating?: number;
  license?: string;
  downloadCount?: number;
  formats: string[];
}

const DEFAULT_STATS: ProtocolStats = {
  circulating_supply: BigInt(0),
  initial_supply: BigInt(0),
  total_burned: BigInt(0),
  current_tier: 1,
  burn_rate: 0,
  liquidity_rate: 0,
  uploader_rate: 0,
  total_datasets: 0,
  total_purchases: 0,
  active_creators: 0,
  total_volume: BigInt(0),
};

const KNOWN_LANGUAGE_TAGS: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  chinese: 'zh',
  mandarin: 'zh',
  japanese: 'ja',
  korean: 'ko',
  hindi: 'hi',
};

type ApiQueryParams = {
  cursor?: string;
  query?: string;
  filter?: DatasetFilter;
  limit?: number;
};

type FreeSoundRepositoryOptions = {
  bundleSize?: number;
};

export class FreeSoundRepository implements DataRepository {
  private readonly endpoint = '/api/freesound';
  private readonly cache = new Map<string, Dataset>();
  private readonly options: Required<FreeSoundRepositoryOptions>;

  constructor(options: FreeSoundRepositoryOptions = {}) {
    const bundleSize = options.bundleSize ?? 10;
    this.options = {
      bundleSize: Math.min(Math.max(bundleSize, 1), 10),
    };
  }

  async getDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    const response = await this.fetchDatasets({
      filter,
      limit: this.options.bundleSize,
    });

    // Map datasets with async Walrus cache lookup
    const datasets = await Promise.all(
      response.data.map(dataset => this.mapDataset(dataset))
    );

    // Populate cache
    datasets.forEach(dataset => this.cache.set(dataset.id, dataset));

    // Create single bundle dataset from all clips
    const bundleDataset = this.createBundleDataset(datasets);

    return [bundleDataset];  // Return single bundle instead of individual clips
  }

  async getDataset(id: string): Promise<Dataset> {
    // Handle bundle dataset request
    if (id === 'freesound-bundle') {
      const response = await this.fetchDatasets({ limit: this.options.bundleSize });
      const datasets = await Promise.all(
        response.data.map(dataset => this.mapDataset(dataset))
      );
      datasets.forEach(dataset => this.cache.set(dataset.id, dataset));
      return this.createBundleDataset(datasets);
    }

    // Check cache first
    const cached = this.cache.get(id);
    if (cached) {
      return cached;
    }

    const res = await fetch(`${this.endpoint}/${id}`);

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const message = errorBody.error || `Failed to fetch FreeSound dataset ${id}`;

      // Tag 404 responses with custom code for retry logic
      if (res.status === 404) {
        // Log warning once (not on every retry)
        if (typeof window !== 'undefined' && !this.cache.has(`warned:${id}`)) {
          console.warn(`[FreeSoundRepository] Dataset ${id} not found (404)`);
          this.cache.set(`warned:${id}` as any, true as any);
        }
        const error = new Error(message) as Error & { code?: string; status?: number };
        error.code = 'FREESOUND_DATASET_NOT_FOUND';
        error.status = 404;
        throw error;
      }

      // Include HTTP status in error for other failures
      const error = new Error(message) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }

    const payload = await res.json();
    const dataset = await this.mapDataset(payload as ApiDataset);

    // Cache the result
    this.cache.set(id, dataset);

    return dataset;
  }

  async getStats(): Promise<ProtocolStats> {
    const response = await this.fetchDatasets({ limit: this.options.bundleSize });
    const datasets = response.data;
    const uniqueCreators = new Set(datasets.map(d => d.creator));

    return {
      ...DEFAULT_STATS,
      total_datasets: response.total,
      total_purchases: datasets.reduce((sum, dataset) => sum + (dataset.downloadCount ?? 0), 0),
      active_creators: uniqueCreators.size,
    };
  }

  async getDatasetsPaginated(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>> {
    const response = await this.fetchDatasets({
      filter,
      cursor,
      limit: this.options.bundleSize,
    });

    // Map datasets with async Walrus cache lookup
    const datasets = await Promise.all(
      response.data.map(dataset => this.mapDataset(dataset))
    );

    // Populate cache
    datasets.forEach(dataset => this.cache.set(dataset.id, dataset));

    const filtered = this.applyFilters(datasets, filter);

    return {
      data: filtered,
      cursor: response.cursor,
      hasMore: response.hasMore,
    };
  }

  /**
   * Create a bundle dataset from multiple individual clips
   */
  private createBundleDataset(clips: Dataset[]): Dataset {
    if (clips.length === 0) {
      throw new Error('Cannot create bundle from empty clips array');
    }

    // Aggregate metadata from all clips
    const totalDuration = clips.reduce((sum, clip) => sum + clip.duration_seconds, 0);
    const allLanguages = Array.from(new Set(clips.flatMap(clip => clip.languages)));
    const allFormats = Array.from(new Set(clips.flatMap(clip => clip.formats)));
    const avgQuality = Math.round(
      clips.reduce((sum, clip) => sum + clip.quality_score, 0) / clips.length
    );
    const totalPurchases = clips.reduce((sum, clip) => sum + (clip.total_purchases || 0), 0);

    // Get first 3 clip descriptions for bundle description
    const descriptions = clips.slice(0, 3).map(c => c.title);
    const remainingCount = clips.length - 3;
    const bundleDescription = remainingCount > 0
      ? `${descriptions.join(', ')}...and ${remainingCount} more clips`
      : descriptions.join(', ');

    return {
      id: 'freesound-bundle',
      title: 'Freesound.org Audio clips',
      creator: 'Multiple creators',
      description: bundleDescription,
      duration_seconds: totalDuration,
      quality_score: avgQuality,
      price: BigInt(0),
      listed: false,
      sample_count: clips.length,
      storage_size: 0,
      verified: false,
      languages: allLanguages,
      formats: allFormats,
      media_type: 'audio' as const,
      created_at: clips[0]?.created_at || Date.now(),
      updated_at: Date.now(),
      total_purchases: totalPurchases,
      previewUrl: clips[0]?.previewUrl,  // Use first clip's preview for waveform
      bundled_clips: clips,  // Store all individual clips
    };
  }

  private async fetchDatasets(params: ApiQueryParams = {}): Promise<ApiDatasetResponse> {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const url = new URL(`${this.endpoint}/search`, base);

    if (params.query) {
      url.searchParams.set('query', params.query);
    }

    if (params.cursor) {
      url.searchParams.set('cursor', params.cursor);
    }

    if (params.limit) {
      url.searchParams.set('limit', params.limit.toString());
    }

    if (params.filter?.languages) {
      params.filter.languages.forEach(lang => url.searchParams.append('language', lang));
    }

    if (params.filter?.formats) {
      params.filter.formats.forEach(format => url.searchParams.append('format', format));
    }

    if (params.filter?.min_quality !== undefined) {
      url.searchParams.set('minQuality', params.filter.min_quality.toString());
    }

    if (params.filter?.max_price !== undefined) {
      url.searchParams.set('maxPrice', params.filter.max_price.toString());
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const message = errorBody.error || `Failed to load FreeSound datasets (${res.status})`;
        throw new Error(message);
      }

      return res.json() as Promise<ApiDatasetResponse>;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw error;
      }
      throw new Error('Failed to fetch datasets');
    }
  }

  private async mapDataset(dataset: ApiDataset): Promise<Dataset> {
    const createdAt = Number.isFinite(Date.parse(dataset.createdAt))
      ? new Date(dataset.createdAt).getTime()
      : Date.now();

    const languages = this.deriveLanguages(dataset.tags);
    const formats = this.normalizeFormats(dataset.formats);
    const qualityScore = this.deriveQualityScore(dataset.avgRating);
    const duration = Math.round(dataset.duration || 0);

    // Check if Walrus blob ID exists in cache
    let previewUrl = this.extractPreviewUrl(dataset.previews);

    try {
      const cacheResponse = await fetch(`/api/cache/freesound/${dataset.id}`);
      if (cacheResponse.ok) {
        const { blobId } = await cacheResponse.json();
        const walrusUrl = `${this.getWalrusAggregatorUrl()}/v1/blobs/${blobId}`;

        // Use Walrus URL if cached
        previewUrl = walrusUrl;

        if (typeof window !== 'undefined') {
          console.log(`[FreeSoundRepository] Using Walrus blob for ${dataset.id}: ${blobId}`);
        }
      }
    } catch (error) {
      // Fallback to Freesound preview URL if cache lookup fails
      if (typeof window !== 'undefined') {
        console.log(`[FreeSoundRepository] Cache miss for ${dataset.id}, using Freesound preview`);
      }
    }

    // Debug logging
    if (typeof window !== 'undefined') {
      console.log(`[FreeSoundRepository] Dataset ${dataset.id} preview URL:`, previewUrl);
    }

    const rawDataset = {
      id: dataset.id,
      creator: dataset.creator || 'freesound-user',
      quality_score: qualityScore,
      price: '0',
      listed: false,
      duration_seconds: duration,
      languages,
      formats,
      media_type: 'audio' as const,
      created_at: createdAt,
      updated_at: createdAt,
      title: dataset.title,
      description: dataset.description ?? '',
      total_purchases: dataset.downloadCount ?? 0,
      verified: false,
      sample_count: 1,
      storage_size: 0,
      previewUrl,
    };

    return parseDataset(rawDataset);
  }

  private deriveQualityScore(avgRating?: number): number {
    if (typeof avgRating !== 'number' || Number.isNaN(avgRating)) {
      return 70;
    }

    const normalized = Math.min(Math.max(avgRating, 0), 5);
    return Math.round((normalized / 5) * 100);
  }

  private deriveLanguages(tags: string[]): string[] {
    const languages = new Set<string>();

    tags.forEach((tag) => {
      const normalized = tag.toLowerCase();
      const languageCode = KNOWN_LANGUAGE_TAGS[normalized];
      if (languageCode) {
        languages.add(languageCode);
      }
    });

    if (languages.size === 0) {
      languages.add('en');
    }

    return Array.from(languages);
  }

  private normalizeFormats(formats: string[]): Array<'mp3' | 'wav' | 'ogg'> {
    const allowed: Array<'mp3' | 'wav' | 'ogg'> = ['mp3', 'wav', 'ogg'];
    return Array.from(
      new Set(
        formats
          .map((format) => format.toLowerCase())
          .filter((format): format is 'mp3' | 'wav' | 'ogg' => allowed.includes(format as any))
      )
    );
  }

  /**
   * Get Walrus aggregator URL
   */
  private getWalrusAggregatorUrl(): string {
    if (typeof window !== 'undefined') {
      // Client-side: use environment variable or default
      return process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ||
        'https://aggregator.walrus-testnet.walrus.space';
    }
    // Server-side fallback
    return 'https://aggregator.walrus-testnet.walrus.space';
  }

  /**
   * Extract the best quality preview URL from Freesound previews
   * Priority: preview-hq-mp3 > preview-lq-mp3 > preview-hq-ogg > preview-lq-ogg
   */
  private extractPreviewUrl(previews: Record<string, string>): string | undefined {
    const priority = ['preview-hq-mp3', 'preview-lq-mp3', 'preview-hq-ogg', 'preview-lq-ogg'];

    for (const key of priority) {
      if (previews[key]) {
        return previews[key];
      }
    }

    // Fallback to any available preview
    return Object.values(previews)[0];
  }

  private applyFilters(datasets: Dataset[], filter?: DatasetFilter): Dataset[] {
    if (!filter) return datasets;

    let filtered = datasets;

    if (filter.media_type) {
      filtered = filtered.filter(d => d.media_type === filter.media_type);
    }

    if (filter.languages && filter.languages.length > 0) {
      filtered = filtered.filter(d => filter.languages!.some(lang => d.languages.includes(lang)));
    }

    if (filter.formats && filter.formats.length > 0) {
      filtered = filtered.filter(d => filter.formats!.some(format => d.formats.includes(format)));
    }

    if (filter.min_quality !== undefined) {
      filtered = filtered.filter(d => d.quality_score >= filter.min_quality!);
    }

    if (filter.max_price !== undefined) {
      filtered = filtered.filter(d => d.price <= filter.max_price!);
    }

    if (filter.creator) {
      filtered = filtered.filter(d => d.creator === filter.creator);
    }

    return filtered;
  }
}
