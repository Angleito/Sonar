import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';
import { DataRepository, parseDataset, parseProtocolStats } from './repository';
import { suiClient, graphqlClient, DATASET_TYPE, STATS_OBJECT_ID } from '@/lib/sui/client';
import { GET_DATASETS, GET_DATASET, GET_PROTOCOL_STATS } from '@/lib/sui/queries';

/**
 * Exponential backoff retry utility
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Sui Blockchain Repository
 * Queries real on-chain data with GraphQL for lists and RPC for critical reads
 * Includes automatic fallback from GraphQL to RPC on failure with retry logic
 */
export class SuiRepository implements DataRepository {
  async getDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    // Try GraphQL first with retry logic
    try {
      return await retryWithBackoff(() => this.getDatasetsViaGraphQL(filter));
    } catch (graphqlError) {
      console.warn('GraphQL query failed, attempting RPC fallback', graphqlError);
      // Fallback to RPC if GraphQL fails
      return await this.getDatasetsViaRPC(filter);
    }
  }

  async getDataset(id: string): Promise<Dataset> {
    // Always use RPC for critical single-object reads (more reliable)
    const obj = await suiClient.getObject({
      id,
      options: { showContent: true },
    });

    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      throw new Error(`Dataset not found: ${id}`);
    }

    return parseDataset({
      id: obj.data.objectId,
      ...obj.data.content.fields,
    });
  }

  async getStats(): Promise<ProtocolStats> {
    // Use RPC for stats (critical read)
    const obj = await suiClient.getObject({
      id: STATS_OBJECT_ID,
      options: { showContent: true },
    });

    if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
      throw new Error('Protocol stats not found');
    }

    return parseProtocolStats(obj.data.content.fields);
  }

  async getDatasetsPaginated(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>> {
    return this.getDatasetsPaginatedViaGraphQL(filter, cursor);
  }

  // Private methods for GraphQL queries
  private async getDatasetsViaGraphQL(filter?: DatasetFilter): Promise<Dataset[]> {
    const response = await graphqlClient.request(GET_DATASETS, {
      type: DATASET_TYPE,
      cursor: null,
    });

    const datasets = response.objects.nodes.map((node: any) => {
      const content = JSON.parse(node.asMoveObject.contents.json);
      return parseDataset({
        id: node.address,
        ...content,
      });
    });

    // Apply filters client-side (Move contracts don't support complex filters yet)
    return this.applyFilters(datasets, filter);
  }

  private async getDatasetsPaginatedViaGraphQL(
    filter?: DatasetFilter,
    cursor?: string
  ): Promise<PaginatedResponse<Dataset>> {
    const response = await graphqlClient.request(GET_DATASETS, {
      type: DATASET_TYPE,
      cursor: cursor || null,
    });

    const datasets = response.objects.nodes.map((node: any) => {
      const content = JSON.parse(node.asMoveObject.contents.json);
      return parseDataset({
        id: node.address,
        ...content,
      });
    });

    const filtered = this.applyFilters(datasets, filter);

    return {
      data: filtered,
      cursor: response.objects.pageInfo.endCursor,
      hasMore: response.objects.pageInfo.hasNextPage,
    };
  }

  // RPC fallback for list queries
  private async getDatasetsViaRPC(filter?: DatasetFilter): Promise<Dataset[]> {
    console.info('Using RPC fallback for dataset list query');

    // Query objects of the dataset type using RPC
    const response = await suiClient.queryObjects({
      filter: { StructType: DATASET_TYPE },
      options: { showContent: true },
    });

    const datasets = response.data
      .filter(obj => obj.data?.content && obj.data.content.dataType === 'moveObject')
      .map(obj => {
        const content = obj.data!.content as { fields: any };
        return parseDataset({
          id: obj.data!.objectId,
          ...content.fields,
        });
      });

    return this.applyFilters(datasets, filter);
  }

  // Helper: Apply filters to dataset array
  private applyFilters(datasets: Dataset[], filter?: DatasetFilter): Dataset[] {
    if (!filter) return datasets;

    let filtered = datasets;

    if (filter.media_type) {
      filtered = filtered.filter(d => d.media_type === filter.media_type);
    }

    if (filter.languages && filter.languages.length > 0) {
      filtered = filtered.filter(d =>
        filter.languages!.some(lang => d.languages.includes(lang))
      );
    }

    if (filter.formats && filter.formats.length > 0) {
      filtered = filtered.filter(d =>
        filter.formats!.some(format => d.formats.includes(format))
      );
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
