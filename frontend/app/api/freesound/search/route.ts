import { NextRequest, NextResponse } from 'next/server';
import { searchFreeSound, type FreeSoundItem } from '@/lib/freesound/client';
import type { DatasetFilter } from '@/types/blockchain';

interface FreeSoundApiDataset {
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

interface ApiResponse {
  data: FreeSoundApiDataset[];
  cursor?: string;
  hasMore: boolean;
  total: number;
}

function parseFilter(searchParams: URLSearchParams): DatasetFilter {
  const filter: DatasetFilter = {};

  const languages = searchParams.getAll('language');
  if (languages.length > 0) {
    filter.languages = languages;
  }

  const formats = searchParams.getAll('format');
  if (formats.length > 0) {
    filter.formats = formats as DatasetFilter['formats'];
  }

  const minQuality = searchParams.get('minQuality');
  if (minQuality) {
    filter.min_quality = Number(minQuality);
  }

  const maxPrice = searchParams.get('maxPrice');
  if (maxPrice) {
    try {
      filter.max_price = BigInt(maxPrice);
    } catch {
      // Ignore invalid values
    }
  }

  return filter;
}

function extractFormats(previews: Record<string, string>): string[] {
  const formats = new Set<string>();
  Object.keys(previews || {}).forEach((key) => {
    if (key.includes('mp3')) formats.add('mp3');
    if (key.includes('ogg')) formats.add('ogg');
    if (key.includes('wav')) formats.add('wav');
  });
  return Array.from(formats);
}

function normalizeItem(item: FreeSoundItem): FreeSoundApiDataset {
  return {
    id: item.id.toString(),
    title: item.name,
    description: item.description,
    creator: item.username,
    duration: item.duration,
    tags: item.tags,
    previews: item.previews,
    createdAt: item.created,
    avgRating: item.avg_rating,
    license: item.license,
    downloadCount: item.num_downloads,
    formats: extractFormats(item.previews),
  };
}

function mapFilterToTags(filter: DatasetFilter): string[] {
  const tags = new Set<string>();

  if (filter.languages) {
    const languageTags: Record<string, string> = {
      en: 'english',
      es: 'spanish',
      fr: 'french',
      de: 'german',
      it: 'italian',
      pt: 'portuguese',
      zh: 'chinese',
      ja: 'japanese',
      ko: 'korean',
    };

    filter.languages.forEach((lang) => {
      const normalized = languageTags[lang.toLowerCase()];
      if (normalized) {
        tags.add(normalized);
      }
    });
  }

  if (filter.formats) {
    filter.formats.forEach((format) => {
      if (format === 'wav' || format === 'mp3' || format === 'ogg') {
        tags.add(format);
      }
    });
  }

  return Array.from(tags);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = parseFilter(searchParams);
  const cursor = searchParams.get('cursor');
  const query = searchParams.get('query') ?? undefined;
  const requestedLimit = Number(searchParams.get('limit') ?? '10');
  const sanitizedLimit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : 10;
  const pageSize = Math.min(sanitizedLimit, 10);
  const page = cursor ? Number.parseInt(cursor, 10) : Number(searchParams.get('page') ?? '1');

  try {
    const searchResult = await searchFreeSound({
      query,
      tags: mapFilterToTags(filter),
      page: Number.isFinite(page) && page > 0 ? page : 1,
      pageSize,
    });

    const data = searchResult.results.slice(0, pageSize).map(normalizeItem);

    const response: ApiResponse = {
      data,
      cursor: undefined,
      hasMore: false,
      total: data.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({ error: message }, { status });
  }
}
