import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Painter's brush sweep between pages: a wide ink stroke crosses the screen
 * (in reading direction) each time the path changes. Skipped for reduced motion.
 */
export function BrushTransition() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const first = useRef(true);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setRun((n) => n + 1);
  }, [path]);

  if (!run) return null;
  return (
    <div key={run} aria-hidden className="brush-sweep pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <filter id="brush-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" /><feDisplacementMap in="SourceGraphic" scale="38" /></filter>
        </defs>
        <g filter="url(#brush-rough)">
          <path className="brush-stroke fill-primary" d="M-100 120 C 250 40, 600 180, 1300 90 L 1300 330 C 800 400, 400 260, -100 360 Z" />
          <path className="brush-stroke brush-stroke-2 fill-accent" d="M-100 330 C 300 260, 700 420, 1300 300 L 1300 540 C 700 620, 350 480, -100 580 Z" />
          <path className="brush-stroke brush-stroke-3 fill-foreground" d="M-100 540 C 350 470, 750 620, 1300 520 L 1300 760 C 800 840, 400 700, -100 820 Z" />
        </g>
      </svg>
    </div>
  );
}
