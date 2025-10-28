import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

/**
 * Glass Card Component
 * Aquatic-themed card with glass morphism effect
 * WCAG AAA compliant text colors
 */
export function GlassCard({ children, className, glow, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel rounded-sonar p-6',
        'text-sonar-highlight-bright', // WCAG AAA compliant
        glow && 'sonar-glow-hover',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}
