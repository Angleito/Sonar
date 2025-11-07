import { NextRequest, NextResponse } from 'next/server';
import { createVerificationSession } from '@/lib/kv/verification';
import { preCheckVerification, estimateVerificationTime } from '@/lib/ai/verification-pipeline';

// Mark as Edge Runtime
export const runtime = 'edge';

const WALRUS_AGGREGATOR_URL =
  process.env.WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space';

/**
 * Edge Function: Start AI Verification
 * Triggers async verification workflow for uploaded dataset
 *
 * POST /api/edge/verify
 * Body: {
 *   walrusBlobId: string;
 *   metadata: DatasetMetadata;
 *   audioMetadata?: { duration: number; fileSize: number; format: string };
 * }
 * Returns: { verificationId: string; estimatedTime: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walrusBlobId, metadata, audioMetadata } = body;

    // Validate input
    if (!walrusBlobId || typeof walrusBlobId !== 'string') {
      return NextResponse.json(
        { error: 'walrusBlobId is required' },
        { status: 400 }
      );
    }

    if (!metadata || typeof metadata !== 'object') {
      return NextResponse.json(
        { error: 'metadata is required' },
        { status: 400 }
      );
    }

    // Validate metadata structure
    if (!metadata.title || !metadata.description || !metadata.languages || !metadata.tags) {
      return NextResponse.json(
        { error: 'Invalid metadata structure' },
        { status: 400 }
      );
    }

    // Create verification session in KV
    const verificationId = await createVerificationSession(
      walrusBlobId,
      metadata.title,
      audioMetadata?.duration
    );

    // Estimate verification time
    const estimatedTime = audioMetadata?.duration
      ? estimateVerificationTime(audioMetadata.duration)
      : 120; // Default 2 minutes

    // Trigger background worker via API route
    // Note: We'll call a separate API route that handles the async processing
    // This is necessary because Edge Functions have time limits (25s on Hobby, 30s on Pro)
    const workerUrl = new URL('/api/edge/verify/worker', request.url);

    // Fire-and-forget request to worker (don't await)
    fetch(workerUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Verification-ID': verificationId,
      },
      body: JSON.stringify({
        verificationId,
        walrusBlobId,
        metadata,
        audioMetadata,
      }),
    }).catch((error) => {
      console.error('Failed to trigger worker:', error);
    });

    return NextResponse.json({
      verificationId,
      estimatedTime,
      status: 'pending',
      message: 'Verification started. Use GET /api/edge/verify/{id} to poll status.',
    });
  } catch (error) {
    console.error('Verification start error:', error);
    return NextResponse.json(
      {
        error: 'Failed to start verification',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
