import { buildVerifierUrl } from '@/lib/config/verifier';

type BodySource =
  | { mode: 'json'; payload: any }
  | { mode: 'formData'; payload: FormData }
  | { mode: 'stream'; contentType?: string | null; body: BodyInit | null };

interface ProxyOptions {
  body: BodySource;
}

export interface ProxyResult {
  status: number;
  data: any;
  ok: boolean;
}

const VERIFIER_AUTH_TOKEN = process.env.VERIFIER_AUTH_TOKEN;

export const ensureVerifierToken = () => {
  if (!VERIFIER_AUTH_TOKEN) {
    throw new Error('VERIFIER_AUTH_TOKEN not configured on server');
  }
  return VERIFIER_AUTH_TOKEN;
};

export const proxyVerifyRequest = async ({ body }: ProxyOptions): Promise<ProxyResult> => {
  const token = ensureVerifierToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  let requestBody: BodyInit | undefined;

  switch (body.mode) {
    case 'json':
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body.payload);
      break;
    case 'formData':
      requestBody = body.payload as any;
      break;
    case 'stream':
      if (body.contentType) {
        headers['Content-Type'] = body.contentType;
      }
      requestBody = body.body ?? undefined;
      break;
    default:
      throw new Error('Unsupported body mode');
  }

  const response = await fetch(buildVerifierUrl('verify'), {
    method: 'POST',
    headers,
    body: requestBody,
  });

  const text = await response.text();
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { detail: text };
    }
  }

  if (!response.ok) {
    const errorMessage = parsed?.detail || parsed?.error || 'Verification service error';
    return {
      status: response.status,
      ok: false,
      data: { error: errorMessage },
    };
  }

  return {
    status: response.status,
    ok: true,
    data: parsed,
  };
};

