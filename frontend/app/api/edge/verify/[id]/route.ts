import { NextRequest, NextResponse } from 'next/server';
import { getVerificationSession, sessionToResult } from '@/lib/kv/verification';

// Mark as Edge Runtime
export const runtime = 'edge';

/**
 * Edge Function: Get Verification Status
 * Poll verification progress and results
 *
 * GET /api/edge/verify/[id]
 * Returns: VerificationResult
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const verificationId = params.id;

    if (!verificationId) {
      return NextResponse.json(
        { error: 'Verification ID is required' },
        { status: 400 }
      );
    }

    // Get session from KV
    const session = await getVerificationSession(verificationId);

    if (!session) {
      return NextResponse.json(
        {
          error: 'Verification not found',
          message: 'Verification session may have expired (24 hour TTL)',
        },
        { status: 404 }
      );
    }

    // Convert to frontend format
    const result = sessionToResult(session);

    // Add cache headers for short-term caching
    const headers = new Headers();

    if (result.state === 'completed' || result.state === 'failed') {
      // Cache completed/failed results for 5 minutes
      headers.set('Cache-Control', 'public, max-age=300');
    } else {
      // Don't cache pending/processing results
      headers.set('Cache-Control', 'no-store');
    }

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error('Get verification status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get verification status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
