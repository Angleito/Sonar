import { cn } from '@/lib/utils';

interface SignalBadgeProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  className?: string;
}

/**
 * Signal Badge Component
 * Small pill-shaped badge for status indicators
 * High contrast colors for WCAG AA compliance
 */
export function SignalBadge({
  children,
  variant = 'info',
  className
}: SignalBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full',
        'text-xs font-mono uppercase tracking-radar',
        'border backdrop-blur-sm whitespace-nowrap',
        variant === 'info' &&
          'bg-sonar-signal/20 border-sonar-signal text-sonar-highlight-bright',
        variant === 'success' &&
          'bg-green-500/20 border-green-500 text-green-200',
        variant === 'warning' &&
          'bg-sonar-coral/20 border-sonar-coral text-orange-200',
        variant === 'danger' &&
          'bg-red-500/20 border-red-500 text-red-200',
        className
      )}
    >
      {children}
    </span>
  );
}
