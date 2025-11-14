import type { NextApiRequest, NextApiResponse } from 'next';
import { proxyVerifyRequest } from '@/lib/server/verifyProxy';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const result = await proxyVerifyRequest({
      body: {
        mode: 'stream',
        contentType: req.headers['content-type'],
        body: req,
      },
    });

    return res.status(result.status).json(result.data);
  } catch (error: any) {
    console.error('Pages API /api/verify error:', error);
    return res.status(500).json({ error: error.message || 'Failed to start verification' });
  }
}

