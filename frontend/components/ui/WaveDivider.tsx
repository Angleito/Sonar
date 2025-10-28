/**
 * Wave Divider Component
 * Decorative SVG wave for section breaks
 * Aquatic theme element
 */
export function WaveDivider() {
  return (
    <div className="relative w-full h-12 overflow-hidden my-4">
      <svg
        className="absolute bottom-0 w-full h-full"
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,0 C300,60 900,60 1200,0 L1200,120 L0,120 Z"
          fill="url(#wave-gradient)"
          opacity="0.15"
        />
        <defs>
          <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1AA4D9" />
            <stop offset="50%" stopColor="#74E4FF" />
            <stop offset="100%" stopColor="#1AA4D9" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
