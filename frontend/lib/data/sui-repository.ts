import type { Dataset, ProtocolStats, DatasetFilter, PaginatedResponse } from '@/types/blockchain';
import { DataRepository, parseDataset, parseProtocolStats } from './repository';
import { suiClient, graphqlClient, DATASET_TYPE, STATS_OBJECT_ID } from '@/lib/sui/client';
import { GET_DATASETS, GET_DATASET, GET_PROTOCOL_STATS } from '@/lib/sui/queries';

/**
 * Sui Blockchain Repository
 * Queries real on-chain data with GraphQL for lists and RPC for critical reads
 * Includes automatic fallback from GraphQL to RPC on failure
 */
export class SuiRepository implements DataRepository {
  async getDatasets(filter?: DatasetFilter): Promise<Dataset[]> {
    try {
      // Try GraphQL first (efficient for list queries)
      return await this.getDatasetsViaGraphQL(filter);
    } catch (error) {
      console.warn('GraphQL failed, falling back to RPC:', error);
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
    try {
      return await this.getDatasetsPaginatedViaGraphQL(filter, cursor);
    } catch (error) {
      console.warn('GraphQL pagination failed, falling back to RPC:', error);
      // Fallback: get all and paginate client-side
      const allDatasets = await this.getDatasetsViaRPC(filter);
      return this.paginateClientSide(allDatasets, cursor);
    }
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

  // Private method for RPC fallback
  private async getDatasetsViaRPC(filter?: DatasetFilter): Promise<Dataset[]> {
    // Use getOwnedObjects as fallback (less efficient but reliable)
    const response = await suiClient.getOwnedObjects({
      filter: { StructType: DATASET_TYPE },
      options: { showContent: true },
    });

    const datasets = response.data
      .filter(obj => obj.data?.content?.dataType === 'moveObject')
      .map(obj => {
        const content = obj.data!.content as any;
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

  // Helper: Client-side pagination
  private paginateClientSide(
    datasets: Dataset[],
    cursor?: string
  ): PaginatedResponse<Dataset> {
    const pageSize = 12;
    let startIndex = 0;

    if (cursor) {
      startIndex = parseInt(cursor, 10);
    }

    const endIndex = startIndex + pageSize;
    const data = datasets.slice(startIndex, endIndex);
    const hasMore = endIndex < datasets.length;
    const nextCursor = hasMore ? endIndex.toString() : undefined;

    return { data, cursor: nextCursor, hasMore };
  }
}
