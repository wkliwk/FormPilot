"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  target: number;
  /** Duration of count-up animation in ms (default 1500) */
  duration?: number;
  /** Fallback: start animation after this many ms without IntersectionObserver (default 3000) */
  fallbackDelay?: number;
}

export default function AnimatedCounter({ target, duration = 1500, fallbackDelay = 3000 }: Props) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  function startAnimation() {
    if (started.current) return;
    started.current = true;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (target === 0) return;

    // Fallback: start after fallbackDelay regardless of scroll position
    const fallback = setTimeout(startAnimation, fallbackDelay);

    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return () => clearTimeout(fallback);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          clearTimeout(fallback);
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);

    return () => {
      clearTimeout(fallback);
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}
