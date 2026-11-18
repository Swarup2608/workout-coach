"use client";

import { useEffect, useRef } from "react";

const MA = ["Weekly plan editor", "Set-by-set logging", "Weekly scoring", "AI coach chat", "Calories & protein", "Plain-language Quick Add"];
function MarqueeRow({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let paused = false;
    let raf = 0;
    let last = performance.now();
    let resume: ReturnType<typeof setTimeout> | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = () => {
      paused = true;
      clearTimeout(resume);
      resume = setTimeout(() => (paused = false), 2500);
    };
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const half = el.scrollWidth / 2;
      if (!paused && !reduced) el.scrollLeft += dt * 0.05;
      // Seamless loop: content is two identical halves
      if (el.scrollLeft >= half) el.scrollLeft -= half;
      else if (el.scrollLeft <= 0 && half > 0 && paused) el.scrollLeft += half;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    el.addEventListener("touchmove", hold, { passive: true });
    el.addEventListener("mouseenter", hold);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resume);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchmove", hold);
      el.removeEventListener("mouseenter", hold);
    };
  }, []);
  const repeated = [...items, ...items, ...items, ...items];
  return (
    <div className="marquee-row" ref={ref}>
      <div className="marquee-track">
        {repeated.map((t, i) => (
          <span key={i}>
            {t}
            <i aria-hidden="true">✦</i>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section className="marquee" aria-label="Capabilities">
      <MarqueeRow items={MA} />
    </section>
  );
}
