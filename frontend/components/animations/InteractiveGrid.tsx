'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Dot {
  x: number;
  y: number;
  render: (
    ctx: CanvasRenderingContext2D,
    mouse: Dot,
    params: CanvasParams
  ) => void;
}

interface CanvasParams {
  dotDistance: number;
  dotRadius: number;
  minProximity: number;
  repaintAlpha: number;
}

export interface InteractiveGridProps {
  className?: string;
  dotDistance?: number;
  dotRadius?: number;
  minProximity?: number;
  repaintAlpha?: number;
  opacity?: number;
}

/**
 * InteractiveGrid Component
 * Canvas-based interactive dot grid that responds to mouse movement
 * Uses sonar blue theme colors
 */
export function InteractiveGrid({
  className,
  dotDistance = 30,
  dotRadius = 2,
  minProximity = 200,
  repaintAlpha = 1,
  opacity = 0.3,
}: InteractiveGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params] = useState<CanvasParams>({
    dotDistance,
    dotRadius,
    minProximity,
    repaintAlpha,
  });
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const dotsRef = useRef<Dot[]>([]);
  const minProxSquaredRef = useRef(params.minProximity * params.minProximity);

  const createDots = (w: number, h: number) => {
    const newDots: Dot[] = [];
    for (let x = 0; x < w; x += params.dotDistance) {
      for (let y = 0; y < h; y += params.dotDistance) {
        newDots.push({
          x,
          y,
          render: (ctx, mousePos, p) => {
            const dX = x - mousePos.x;
            const dY = y - mousePos.y;
            const distSquared = dX * dX + dY * dY;

            if (distSquared <= minProxSquaredRef.current) {
              const brightness = 50 - (distSquared / minProxSquaredRef.current) * 40;
              // Sonar blue/cyan theme: #1AA4D9 (signal), #74E4FF (highlight)
              const color = `hsl(195, 100%, ${brightness}%)`;

              ctx.fillStyle = color;
              ctx.strokeStyle = color;
              ctx.beginPath();
              ctx.arc(x, y, p.dotRadius, 0, Math.PI * 2);
              ctx.fill();

              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(mousePos.x, mousePos.y);
              ctx.stroke();
            } else {
              // Dim neutral dots (dark sonar abyss)
              ctx.fillStyle = 'rgba(26, 164, 217, 0.15)';
              ctx.beginPath();
              ctx.arc(x, y, p.dotRadius, 0, Math.PI * 2);
              ctx.fill();
            }
          },
        });
      }
    }
    dotsRef.current = newDots;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createDots(canvas.width, canvas.height);
  }, [params.dotDistance]);

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMouse({ x, y });
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createDots(canvas.width, canvas.height);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dotsRef.current.forEach((dot) => dot.render(ctx, mouse, params));
      requestAnimationFrame(animate);
    };

    animate();
  }, [params, mouse]);

  return (
    <div className={cn('pointer-events-none fixed inset-0 z-0', className)}>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ display: 'block', background: 'transparent', opacity }}
        aria-hidden="true"
      />
    </div>
  );
}
