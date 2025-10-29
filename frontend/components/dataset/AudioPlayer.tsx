'use client';

import { useState, useRef } from 'react';
import { SonarButton } from '@/components/ui/SonarButton';
import type { Dataset } from '@/types/blockchain';

interface AudioPlayerProps {
  dataset: Dataset;
}

/**
 * AudioPlayer Component
 * Displays waveform visualization and playback controls
 * Currently shows placeholder UI - will integrate with Walrus storage for actual audio
 */
export function AudioPlayer({ dataset }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(dataset.duration_seconds);

  // Placeholder for audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlayPause = () => {
    // Placeholder - will integrate with actual audio blob from Walrus
    setIsPlaying(!isPlaying);

    // Simulate playback for demo purposes
    if (!isPlaying) {
      const interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            clearInterval(interval);
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Waveform Visualization Placeholder */}
      <div className="relative w-full h-32 bg-sonar-abyss/50 rounded-sonar overflow-hidden border border-sonar-signal/20">
        {/* Waveform bars - visual representation */}
        <div className="flex items-center justify-center h-full gap-1 px-4">
          {Array.from({ length: 50 }).map((_, index) => {
            const height = 20 + Math.sin(index * 0.5) * 15 + Math.random() * 20;
            const isPassed = (index / 50) * 100 < progress;
            return (
              <div
                key={index}
                className={`flex-1 rounded-full transition-colors ${
                  isPassed ? 'bg-sonar-signal' : 'bg-sonar-highlight/30'
                }`}
                style={{
                  height: `${height}%`,
                  maxWidth: '4px',
                }}
              />
            );
          })}
        </div>

        {/* Play progress overlay */}
        <div
          className="absolute top-0 left-0 h-full bg-sonar-signal/10 pointer-events-none transition-all"
          style={{ width: `${progress}%` }}
        />

        {/* Placeholder text */}
        {!isPlaying && currentTime === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-sonar-highlight-bright/50 font-mono">
              Audio Preview (requires purchase for full access)
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-4">
        {/* Play/Pause Button */}
        <SonarButton
          variant="primary"
          onClick={handlePlayPause}
          className="w-12 h-12 rounded-full flex items-center justify-center"
        >
          {isPlaying ? (
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </SonarButton>

        {/* Timeline */}
        <div className="flex-1">
          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-sonar-abyss/50 rounded-full overflow-hidden mb-2 cursor-pointer">
            <div
              className="h-full bg-sonar-signal transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs font-mono text-sonar-highlight-bright/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Volume Control - Placeholder */}
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-sonar-highlight-bright/60"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
        </div>
      </div>

      {/* Format Info */}
      <div className="text-xs text-sonar-highlight-bright/50 font-mono">
        Available formats: {dataset.formats.join(', ')} • Sample rate: 44.1kHz • Bit depth: 16-bit
      </div>

      {/* Note about preview */}
      <div className="p-3 bg-sonar-highlight/5 rounded-sonar border border-sonar-highlight/20">
        <p className="text-xs text-sonar-highlight-bright/70">
          <span className="font-mono text-sonar-highlight">ⓘ Preview Mode:</span> Full audio
          access requires dataset purchase. Encrypted audio is stored on Walrus and decrypted
          with Mysten Seal upon purchase.
        </p>
      </div>
    </div>
  );
}
