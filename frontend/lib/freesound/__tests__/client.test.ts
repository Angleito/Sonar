import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  searchFreeSound,
  __internal,
  FreeSoundApiError,
} from '../client';

const originalFetch = globalThis.fetch;
const originalToken = process.env.FREESOUND_API_TOKEN;

describe('FreeSound client', () => {
  afterEach(() => {
    if (originalToken) {
      process.env.FREESOUND_API_TOKEN = originalToken;
    } else {
      delete process.env.FREESOUND_API_TOKEN;
    }

    globalThis.fetch = originalFetch;
  });

  test('buildSearchUrl includes default tags and query', () => {
    const url = new URL(__internal.buildSearchUrl({}));

    expect(url.searchParams.get('query')).toBe('human conversation');
    expect(url.searchParams.get('filter')).toContain('tag:conversation');
    expect(url.searchParams.get('fields')).toContain('previews');
  });

  test('throws error when FREESOUND_API_TOKEN is missing', async () => {
    delete process.env.FREESOUND_API_TOKEN;

    await expect(searchFreeSound()).rejects.toThrow(FreeSoundApiError);
  });

  test('performs authenticated request with provided token', async () => {
    process.env.FREESOUND_API_TOKEN = 'test-token';

    const responseBody = {
      count: 1,
      next: null,
      previous: null,
      results: [],
    };

    let receivedInput: RequestInfo | undefined;
    let receivedInit: RequestInit | undefined;

    const fetchMock = mock(async (input: RequestInfo, init?: RequestInit) => {
      receivedInput = input;
      receivedInit = init;
      return new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await searchFreeSound({ query: 'dialogue', page: 2, pageSize: 5 });

    expect(result).toEqual(responseBody);
    expect(receivedInit?.headers).toMatchObject({ Authorization: 'Token test-token' });

    expect(receivedInput).toBeDefined();
    const calledUrl = new URL(receivedInput as string);
    expect(calledUrl.searchParams.get('query')).toBe('dialogue');
    expect(calledUrl.searchParams.get('page')).toBe('2');
    expect(calledUrl.searchParams.get('page_size')).toBe('5');
  });

  test('wraps network errors with FreeSoundApiError', async () => {
    process.env.FREESOUND_API_TOKEN = 'token';

    const fetchMock = mock(async () => {
      throw new Error('network failed');
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(searchFreeSound()).rejects.toThrow(FreeSoundApiError);
  });
});
