import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for audio-verifier service
 *
 * SECURITY: Keeps VERIFIER_AUTH_TOKEN server-side and never exposes it to the browser.
 * The browser calls this endpoint, which then proxies to the audio-verifier service
 * with the auth token.
 */

const VERIFIER_URL = process.env.AUDIO_VERIFIER_URL || 'http://localhost:8000';
const VERIFIER_AUTH_TOKEN = process.env.VERIFIER_AUTH_TOKEN;

export async function POST(request: NextRequest) {
  if (!VERIFIER_AUTH_TOKEN) {
    return NextResponse.json(
      { error: 'VERIFIER_AUTH_TOKEN not configured on server' },
      { status: 500 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    // Check if request is JSON (encrypted blob flow) or FormData (legacy flow)
    if (contentType.includes('application/json')) {
      // New encrypted blob flow - JSON payload
      const payload = await request.json();

      // Forward to audio-verifier service with server-side auth token
      const response = await fetch(`${VERIFIER_URL}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERIFIER_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return NextResponse.json(
          { error: error.detail || error.error || 'Verification service error' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);

    } else {
      // Legacy FormData flow (for backwards compatibility)
      const formData = await request.formData();

      // Forward to audio-verifier service with server-side auth token
      const response = await fetch(`${VERIFIER_URL}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERIFIER_AUTH_TOKEN}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        return NextResponse.json(
          { error: error.detail || 'Verification service error' },
          { status: response.status }
        );
      }

      const data = await response.json();
      return NextResponse.json(data);
    }

  } catch (error: any) {
    console.error('Failed to proxy verification request:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start verification' },
      { status: 500 }
    );
  }
}
