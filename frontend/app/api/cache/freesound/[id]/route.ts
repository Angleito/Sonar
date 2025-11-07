import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

/**
 * GET /api/cache/freesound/[id]
 * Check if a Freesound clip has a cached Walrus blob ID
 *
 * Returns: { blobId: string } or 404 if not cached
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const freesoundId = params.id;

    if (!freesoundId || isNaN(Number(freesoundId))) {
      return NextResponse.json(
        { error: 'Invalid Freesound ID' },
        { status: 400 }
      );
    }

    // Query backend Redis cache
    const response = await fetch(`${BACKEND_URL}/api/cache/freesound/${freesoundId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Not cached' },
        { status: 404 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      blobId: data.blobId,
    });
  } catch (error) {
    console.error('Cache lookup error:', error);
    return NextResponse.json(
      { error: 'Cache lookup failed' },
      { status: 500 }
    );
  }
}
