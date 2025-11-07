import { NextRequest, NextResponse } from 'next/server';
import { runVerificationPipeline } from '@/lib/ai/verification-pipeline';

// Mark as Edge Runtime
export const runtime = 'edge';

// Increase max duration for long-running verification
// Note: This may require Vercel Pro plan for durations > 25s
export const maxDuration = 300; // 5 minutes

const WALRUS_AGGREGATOR_URL =
  process.env.WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space';

/**
 * Edge Function: Verification Worker
 * Performs async AI verification workflow
 *
 * POST /api/edge/verify/worker
 * Body: {
 *   verificationId: string;
 *   walrusBlobId: string;
 *   metadata: DatasetMetadata;
 *   audioMetadata?: { duration: number; fileSize: number; format: string };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { verificationId, walrusBlobId, metadata, audioMetadata } = body;

    // Validate input
    if (!verificationId || !walrusBlobId || !metadata) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch audio blob from Walrus
    const walrusUrl = `${WALRUS_AGGREGATOR_URL}/v1/${walrusBlobId}`;

    const audioResponse = await fetch(walrusUrl, {
      method: 'GET',
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio from Walrus: ${audioResponse.statusText}`);
    }

    const audioBlob = await audioResponse.blob();

    // Run verification pipeline
    // This will update KV store as it progresses
    await runVerificationPipeline({
      verificationId,
      audioBlob,
      metadata,
      audioMetadata,
    });

    return NextResponse.json({
      success: true,
      verificationId,
      message: 'Verification completed successfully',
    });
  } catch (error) {
    console.error('Verification worker error:', error);

    // Try to update KV with error status
    // (runVerificationPipeline should handle this, but catch edge cases)
    const { verificationId } = await request.json().catch(() => ({}));

    if (verificationId) {
      try {
        const { failVerification } = await import('@/lib/kv/verification');
        await failVerification(
          verificationId,
          error instanceof Error ? error.message : 'Worker failed'
        );
      } catch (kvError) {
        console.error('Failed to update KV with error:', kvError);
      }
    }

    return NextResponse.json(
      {
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
