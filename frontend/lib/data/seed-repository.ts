import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';
import { DataRepository, parseDataset, parseProtocolStats } from './repository';
import seedData from '@/data/seed.json';

/**
 * Seed Data Repository
 * Uses local JSON file for development before blockchain integration
 * ESM-compatible import with type assertion
 */
export class SeedDataRepository implements DataRepository {
  private data = seedData;

  async getDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    let datasets = this.data.datasets.map(parseDataset);

    if (!filter) return datasets;

    // Apply filters
    if (filter.media_type) {
      datasets = datasets.filter(d => d.media_type === filter.media_type);
    }

    if (filter.languages && filter.languages.length > 0) {
      datasets = datasets.filter(d =>
        filter.languages!.some(lang => d.languages.includes(lang))
      );
    }

    if (filter.formats && filter.formats.length > 0) {
      datasets = datasets.filter(d =>
        filter.formats!.some(format => d.formats.includes(format))
      );
    }

    if (filter.min_quality !== undefined) {
      datasets = datasets.filter(d => d.quality_score >= filter.min_quality!);
    }

    if (filter.max_price !== undefined) {
      datasets = datasets.filter(d => d.price <= filter.max_price!);
    }

    if (filter.creator) {
      datasets = datasets.filter(d => d.creator === filter.creator);
    }

    return datasets;
  }

  async getDataset(id: string): Promise<Dataset> {
    const dataset = this.data.datasets.find(d => d.id === id);
    if (!dataset) {
      throw new Error(`Dataset not found: ${id}`);
    }
    return parseDataset(dataset);
  }

  async getStats(): Promise<ProtocolStats> {
    return parseProtocolStats(this.data.stats);
  }

  async getDatasetsPaginated(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>> {
    const allDatasets = await this.getDatasets(filter);
    const pageSize = 12;

    let startIndex = 0;
    if (cursor) {
      startIndex = parseInt(cursor, 10);
    }

    const endIndex = startIndex + pageSize;
    const data = allDatasets.slice(startIndex, endIndex);
    const hasMore = endIndex < allDatasets.length;
    const nextCursor = hasMore ? endIndex.toString() : undefined;

    return {
      data,
      cursor: nextCursor,
      hasMore,
    };
  }
}
