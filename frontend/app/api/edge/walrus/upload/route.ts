import { NextRequest, NextResponse } from 'next/server';

// Mark as Edge Runtime
export const runtime = 'edge';

const WALRUS_PUBLISHER_URL =
  process.env.NEXT_PUBLIC_WALRUS_PUBLISHER_URL ||
  'https://publisher.walrus-testnet.walrus.space';

const WALRUS_AGGREGATOR_URL =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ||
  'https://aggregator.walrus-testnet.walrus.space';

/**
 * Edge Function: Walrus Upload Proxy
 * Streams encrypted audio blob to Walrus aggregator and stores metadata
 *
 * POST /api/edge/walrus/upload
 * Body: FormData with:
 *   - file: encrypted blob
 *   - seal_policy_id: Seal identity for decryption
 *   - backup_key: Base64-encoded backup key
 *   - epochs: (optional) Number of epochs to store (default: Walrus default)
 * Returns: { blobId: string, certifiedEpoch: number }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file');
    const sealPolicyId = formData.get('seal_policy_id');
    const backupKey = formData.get('backup_key');
    const epochsParam = formData.get('epochs');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No file provided or invalid file' },
        { status: 400 }
      );
    }

    if (!sealPolicyId || !backupKey) {
      return NextResponse.json(
        { error: 'Missing seal_policy_id or backup_key' },
        { status: 400 }
      );
    }

    // Validate file size (max 500MB for Walrus testnet)
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Build Walrus URL with optional epochs parameter
    const epochs = epochsParam ? parseInt(epochsParam.toString(), 10) : null;
    const walrusUrl = epochs && epochs > 0
      ? `${WALRUS_PUBLISHER_URL}/v1/blobs?epochs=${epochs}`
      : `${WALRUS_PUBLISHER_URL}/v1/blobs`;

    // Upload to Walrus (PUT request as per Walrus HTTP API)
    const uploadResponse = await fetch(walrusUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Walrus upload failed:', errorText);
      return NextResponse.json(
        {
          error: 'Failed to upload to Walrus',
          details: errorText,
        },
        { status: uploadResponse.status }
      );
    }

    const walrusResult = await uploadResponse.json();

    // Walrus returns: { newlyCreated: { blobObject: { id, ... }, ... } }
    // or { alreadyCertified: { blobId, ... } }
    let blobId: string;
    let certifiedEpoch: number | undefined;

    if (walrusResult.newlyCreated) {
      blobId = walrusResult.newlyCreated.blobObject.blobId;
      certifiedEpoch = walrusResult.newlyCreated.blobObject.certifiedEpoch;
    } else if (walrusResult.alreadyCertified) {
      blobId = walrusResult.alreadyCertified.blobId;
      certifiedEpoch = walrusResult.alreadyCertified.certifiedEpoch;
    } else {
      return NextResponse.json(
        { error: 'Unexpected Walrus response format' },
        { status: 500 }
      );
    }

    // Store metadata in backend (non-blocking - return success even if this fails)
    // Note: This will be called after dataset creation on-chain
    // For now, we just return the blobId and metadata to the client
    // The client will store it when calling publish

    return NextResponse.json({
      blobId,
      certifiedEpoch,
      fileSize: file.size,
      seal_policy_id: sealPolicyId,
      // Note: We don't return backup_key for security - it's stored client-side
      // until the dataset is published and linked to a dataset ID
    });
  } catch (error) {
    console.error('Walrus upload error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET method for health check
 */
export async function GET() {
  try {
    // Check if Walrus aggregator is accessible
    const response = await fetch(`${WALRUS_AGGREGATOR_URL}/v1/health`, {
      method: 'GET',
    });

    if (response.ok) {
      return NextResponse.json({
        status: 'healthy',
        aggregator: WALRUS_AGGREGATOR_URL,
      });
    }

    return NextResponse.json(
      {
        status: 'unhealthy',
        aggregator: WALRUS_AGGREGATOR_URL,
      },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
