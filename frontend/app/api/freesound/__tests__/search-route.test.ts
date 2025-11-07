import { describe, expect, mock, beforeEach, test } from 'bun:test';
import { NextRequest } from 'next/server';

const sampleResponse = {
  count: 25,
  next: 'https://freesound.org/apiv2/search/text/?page=2',
  previous: null,
  results: [
    {
      id: 123,
      name: 'Conversational Sample',
      description: 'Sample description',
      previews: {
        'preview-hq-mp3': 'https://example.com/preview.mp3',
      },
      created: '2024-01-01T00:00:00Z',
      duration: 42,
      tags: ['conversation', 'english'],
      username: 'voice_artist',
      license: 'Creative Commons',
      avg_rating: 4.8,
      num_downloads: 1200,
    },
  ],
};

const searchMock = mock(async () => sampleResponse);

mock.module('@/lib/freesound/client', () => ({
  searchFreeSound: searchMock,
}));

import { GET } from '../search/route';

describe('FreeSound search API route', () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockImplementation(async () => sampleResponse);
  });

  test('returns normalized dataset response', async () => {
    const request = new NextRequest('https://example.com/api/freesound/search');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.total).toBe(1);
    expect(body.hasMore).toBe(false);
    expect(body.cursor).toBeUndefined();
    expect(body.data.length).toBe(1);
    expect(body.data[0]).toMatchObject({
      id: '123',
      title: 'Conversational Sample',
      formats: ['mp3'],
      creator: 'voice_artist',
    });
    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 10 }));
  });

  test('propagates errors from client', async () => {
    searchMock.mockImplementationOnce(async () => {
      throw new Error('boom');
    });

    const request = new NextRequest('https://example.com/api/freesound/search');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('boom');
  });
});
