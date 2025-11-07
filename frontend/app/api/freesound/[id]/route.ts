import { NextRequest, NextResponse } from 'next/server';
import { getFreeSoundSound } from '@/lib/freesound/client';

function extractFormats(previews: Record<string, string>): string[] {
  const formats = new Set<string>();
  Object.keys(previews || {}).forEach((key) => {
    if (key.includes('mp3')) formats.add('mp3');
    if (key.includes('ogg')) formats.add('ogg');
    if (key.includes('wav')) formats.add('wav');
  });
  return Array.from(formats);
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sound = await getFreeSoundSound(params.id);

    return NextResponse.json({
      id: sound.id.toString(),
      title: sound.name,
      description: sound.description,
      creator: sound.username,
      duration: sound.duration,
      tags: sound.tags,
      previews: sound.previews,
      createdAt: sound.created,
      avgRating: sound.avg_rating,
      license: sound.license,
      downloadCount: sound.num_downloads,
      formats: extractFormats(sound.previews),
    });
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? (error as any).status : 500;
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json({ error: message }, { status });
  }
}
