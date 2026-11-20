"use client";

import { useState } from "react";

/**
 * Small dependency-free SVG line chart for dated values (bodyweight, e1RM).
 * Colours come from theme tokens so it works in light and dark mode.
 */
export function LineChart({ points, unit, height = 180, label }: { points: { date: string; value: number; note?: string }[]; unit: string; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2)
    return <p className="flex items-center justify-center text-sm text-ink-400" style={{ height }}>{points.length ? "One entry so far. Log another to see a trend." : "No data yet."}</p>;

  const W = 600;
  const H = height;
  const pad = { l: 40, r: 12, t: 12, b: 24 };
  const t = points.map((p) => Date.parse(p.date));
  const v = points.map((p) => p.value);
  const [t0, t1] = [Math.min(...t), Math.max(...t)];
  let [v0, v1] = [Math.min(...v), Math.max(...v)];
  if (v0 === v1) [v0, v1] = [v0 - 1, v1 + 1];
  const spread = v1 - v0;
  v0 -= spread * 0.1;
  v1 += spread * 0.1;
  const x = (ms: number) => pad.l + ((ms - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (val: number) => pad.t + (1 - (val - v0) / (v1 - v0)) * (H - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [v0 + (v1 - v0) * 0.15, (v0 + v1) / 2, v1 - (v1 - v0) * 0.15];
  const h = hover != null ? points[hover] : null;
  const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
  const dateLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label}: from ${fmt(v[0])} to ${fmt(v.at(-1)!)} ${unit}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tv)} y2={y(tv)} stroke="var(--grid-line)" />
            <text x={pad.l - 6} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(tv)}</text>
          </g>
        ))}
        <text x={pad.l} y={H - 6} fontSize="11" fill="var(--muted)">{dateLabel(points[0].date)}</text>
        <text x={W - pad.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{dateLabel(points.at(-1)!.date)}</text>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(t[i])} cy={y(p.value)} r={hover === i ? 5 : 3} fill="var(--accent)" />
        ))}
        {points.map((p, i) => {
          const prev = i ? x(t[i - 1]) : pad.l;
          const next = i < points.length - 1 ? x(t[i + 1]) : W - pad.r;
          const cx = x(t[i]);
          return <rect key={`h${i}`} x={(prev + cx) / 2} y={0} width={Math.max(1, (next - prev) / 2)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />;
        })}
      </svg>
      {h && (
        <div className="pointer-events-none absolute right-2 top-0 rounded-lg border border-ink-700 bg-ink-900 px-2 py-1 text-xs">
          <span className="text-ink-400">{dateLabel(h.date)}:</span> <strong className="text-fg">{fmt(h.value)} {unit}</strong>
          {h.note && <span className="text-ink-400"> · {h.note}</span>}
        </div>
      )}
    </div>
  );
}
