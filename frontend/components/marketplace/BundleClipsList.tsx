'use client';

import { useState } from 'react';
import type { Dataset } from '@/types/blockchain';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatNumber } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';

export interface BundleClipsListProps {
  clips: Dataset[];
  className?: string;
}

/**
 * BundleClipsList Component
 * Displays all individual clips within a bundle dataset
 */
export function BundleClipsList({ clips, className }: BundleClipsListProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const togglePlayback = (clip: Dataset) => {
    const audio = audioElements.get(clip.id) || new Audio(clip.previewUrl);

    if (!audioElements.has(clip.id)) {
      audioElements.set(clip.id, audio);
      audio.addEventListener('ended', () => setPlayingId(null));
    }

    if (playingId === clip.id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause any currently playing audio
      audioElements.forEach((el, id) => {
        if (id !== clip.id) {
          el.pause();
        }
      });

      audio.play().catch(console.error);
      setPlayingId(clip.id);
    }
  };

  return (
    <div className={className}>
      <h2 className="text-2xl font-mono text-sonar-highlight mb-4">
        Bundle Contents ({clips.length} clips)
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {clips.map((clip) => (
          <GlassCard key={clip.id} className="p-4 hover:bg-sonar-signal/5 transition-colors">
            <div className="flex items-start gap-3">
              {/* Play Button */}
              <button
                onClick={() => togglePlayback(clip)}
                className="flex-shrink-0 w-10 h-10 rounded-full bg-sonar-signal/20 hover:bg-sonar-signal/30 flex items-center justify-center transition-colors group"
                title={playingId === clip.id ? 'Pause' : 'Play preview'}
              >
                {playingId === clip.id ? (
                  <Pause size={16} className="text-sonar-highlight" />
                ) : (
                  <Play size={16} className="text-sonar-highlight ml-0.5" />
                )}
              </button>

              {/* Clip Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-mono text-sm text-sonar-highlight truncate">
                  {clip.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-sonar-highlight-bright/60">
                  <span className="font-mono">{clip.creator}</span>
                  <span>•</span>
                  <span>{formatNumber(clip.duration_seconds)}s</span>
                  {clip.quality_score > 0 && (
                    <>
                      <span>•</span>
                      <span>{clip.quality_score}/100</span>
                    </>
                  )}
                </div>

                {/* Tags */}
                {clip.languages.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {clip.languages.map((lang) => (
                      <span
                        key={lang}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-sonar-signal/10 text-sonar-highlight-bright/70 rounded border border-sonar-signal/20"
                      >
                        {lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Clip Identifier */}
              <div className="flex-shrink-0 text-[10px] font-mono px-2 py-1 bg-sonar-abyss/60 rounded border border-white/5 text-sonar-highlight-bright/60">
                {clip.id.slice(0, 6)}…
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-6 text-sm text-sonar-highlight-bright/60 text-center">
        <p>These reference clips are synthetic samples bundled for demo purposes.</p>
        <p className="mt-1">Replace them with your own community submissions.</p>
      </div>
    </div>
  );
}
