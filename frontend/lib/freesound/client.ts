import { logger } from '@/lib/logger';

const API_BASE_URL = 'https://freesound.org/apiv2';
const DEFAULT_TIMEOUT = 15_000; // 15 seconds
const DEFAULT_QUERY = 'human voice';
const DEFAULT_TAGS = ['voice', 'speech', 'human'];
const DEFAULT_FIELDS = [
  'id',
  'name',
  'description',
  'previews',
  'created',
  'duration',
  'tags',
  'username',
  'license',
  'avg_rating',
  'num_downloads',
];

export interface FreeSoundSearchParams {
  query?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
  timeoutMs?: number;
}

export interface FreeSoundSearchResult {
  count: number;
  next: string | null;
  previous: string | null;
  results: FreeSoundItem[];
}

export interface FreeSoundItem {
  id: number;
  name: string;
  description: string;
  previews: Record<string, string>;
  created: string;
  duration: number;
  tags: string[];
  username: string;
  license: string;
  avg_rating?: number;
  num_downloads?: number;
}

export interface FreeSoundSoundDetail extends FreeSoundItem {
  images?: Record<string, string>;
  analysis?: Record<string, unknown>;
}

export class FreeSoundApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getToken(): string {
  const token = process.env.FREESOUND_API_TOKEN;

  if (!token) {
    throw new FreeSoundApiError('FREESOUND_API_TOKEN is not configured', 500);
  }

  return token;
}

function buildSearchUrl({
  query = DEFAULT_QUERY,
  tags = DEFAULT_TAGS,
  page = 1,
  pageSize = 12,
}: FreeSoundSearchParams): string {
  const url = new URL(`${API_BASE_URL}/search/text/`);
  url.searchParams.set('query', query);
  url.searchParams.set('page', Math.max(1, page).toString());
  url.searchParams.set('page_size', Math.min(Math.max(pageSize, 1), 150).toString());
  url.searchParams.set('fields', DEFAULT_FIELDS.join(','));

  if (tags.length > 0) {
    url.searchParams.set('filter', tags.map(tag => `tag:${tag}`).join(' '));
  }

  return url.toString();
}

async function httpGet(url: string, timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${getToken()}`,
        Accept: 'application/json',
      },
      signal: signal ?? controller.signal,
    });

    if (!response.ok) {
      // Clone response before reading body to allow fallback
      const responseClone = response.clone();
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        try {
          errorDetails = await responseClone.text();
        } catch {
          errorDetails = 'Unable to read error response';
        }
      }

      throw new FreeSoundApiError(
        `FreeSound API request failed with status ${response.status}`,
        response.status,
        errorDetails
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof FreeSoundApiError) {
      throw error;
    }

    if ((error as Error).name === 'AbortError') {
      throw new FreeSoundApiError('FreeSound API request timed out', 504);
    }

    logger.error('FreeSound API request failed', error as Error, { url });
    throw new FreeSoundApiError('FreeSound API request failed', 502, {
      message: (error as Error).message,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchFreeSound(
  params: FreeSoundSearchParams = {}
): Promise<FreeSoundSearchResult> {
  const url = buildSearchUrl(params);
  const timeout = params.timeoutMs ?? DEFAULT_TIMEOUT;

  return httpGet(url, timeout) as Promise<FreeSoundSearchResult>;
}

export async function getFreeSoundSound(
  id: string | number,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<FreeSoundSoundDetail> {
  const url = `${API_BASE_URL}/sounds/${id}/`;
  return httpGet(url, timeoutMs) as Promise<FreeSoundSoundDetail>;
}

export const __internal = {
  buildSearchUrl,
};
