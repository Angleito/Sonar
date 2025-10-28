import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Loading Spinner Component
 * Animated radar-style loading indicator
 */
export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-sonar-blue/30" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-sonar-signal animate-spin" />
      <div className="absolute inset-2 rounded-full border border-sonar-signal/20" />
    </div>
  );
}

/**
 * Loading Screen Component
 * Full-screen loading state with spinner
 */
export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sonar-abyss/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <LoadingSpinner size="lg" />
        <p className="text-sonar-highlight font-mono tracking-radar uppercase text-sm">
          Loading...
        </p>
      </div>
    </div>
  );
}
