import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';

export function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    const start = display;
    const diff = value - start;
    if (diff === 0) return;

    const duration = 420;
    const startTime = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, prefersReduced]);

  return (
    <span className="tabular-nums font-mono">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
