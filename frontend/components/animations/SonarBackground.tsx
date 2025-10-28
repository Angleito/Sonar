'use client';

import { useSonarAnimation } from '@/hooks/useSonarAnimation';
import { cn } from '@/lib/utils';

/**
 * SonarBackground Component
 * Full-viewport WebGL sonar animation for hero sections and page backgrounds
 * Automatically falls back to CSS animation for reduced-motion users
 */
export interface SonarBackgroundProps {
  className?: string;
  intensity?: number; // Animation intensity (0-1)
  pulseFrequency?: number; // Pulse interval in seconds
  opacity?: number; // Overall opacity (0-1)
}

export function SonarBackground({
  className,
  intensity = 0.7,
  pulseFrequency = 3.0,
  opacity = 0.4,
}: SonarBackgroundProps) {
  const { containerRef, prefersReducedMotion, hasWebGL } = useSonarAnimation({
    intensity,
    pulseFrequency,
    autoStart: true,
  });

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-0',
        className
      )}
      style={{ opacity }}
    >
      {/* WebGL Canvas */}
      {!prefersReducedMotion && hasWebGL && (
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        />
      )}

      {/* CSS Fallback for Reduced Motion */}
      {(prefersReducedMotion || !hasWebGL) && (
        <div
          className="absolute inset-0 w-full h-full sonar-fallback-animation"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
