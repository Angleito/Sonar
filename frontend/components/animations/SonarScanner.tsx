'use client';

import { useSonarAnimation } from '@/hooks/useSonarAnimation';
import { cn } from '@/lib/utils';

/**
 * SonarScanner Component
 * Compact circular radar component for widgets and UI elements
 * Shows real-time sonar animation with optional detection points
 */
export interface SonarScannerProps {
  className?: string;
  size?: number; // Size in pixels (default: 300)
  intensity?: number; // Animation intensity (0-1)
  pulseFrequency?: number; // Pulse interval in seconds
  showBorder?: boolean; // Show outer border ring
  detectionPoints?: Array<{ angle: number; distance: number }>; // Detection points to display
}

export function SonarScanner({
  className,
  size = 300,
  intensity = 1.0,
  pulseFrequency = 2.5,
  showBorder = true,
  detectionPoints = [],
}: SonarScannerProps) {
  const { containerRef, prefersReducedMotion, hasWebGL } = useSonarAnimation({
    intensity,
    pulseFrequency,
    autoStart: true,
  });

  return (
    <div
      className={cn(
        'relative inline-block',
        showBorder && 'rounded-full border-2 border-sonar-signal/30',
        className
      )}
      style={{
        width: size,
        height: size,
      }}
    >
      {/* WebGL Canvas */}
      {!prefersReducedMotion && hasWebGL && (
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full rounded-full overflow-hidden"
          aria-label="Sonar scanner animation"
        />
      )}

      {/* CSS Fallback for Reduced Motion */}
      {(prefersReducedMotion || !hasWebGL) && (
        <div
          className="absolute inset-0 w-full h-full sonar-scanner-fallback rounded-full overflow-hidden"
          aria-label="Sonar scanner (static)"
        />
      )}

      {/* Detection Points Overlay */}
      {detectionPoints.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {detectionPoints.map((point, index) => {
            // Convert polar to cartesian coordinates
            const x = 50 + point.distance * 50 * Math.cos(point.angle);
            const y = 50 + point.distance * 50 * Math.sin(point.angle);

            return (
              <div
                key={index}
                className="absolute w-2 h-2 bg-sonar-coral rounded-full animate-pulse-slow"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                aria-hidden="true"
              />
            );
          })}
        </div>
      )}

      {/* Center Info (optional slot) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {/* Children can be passed for custom center content */}
        </div>
      </div>
    </div>
  );
}
