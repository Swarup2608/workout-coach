/** Score donut used on the landing pages. Pass `color` (a CSS color) to change the arc from the default gold gradient. */
export function ScoreRing({ score, color = "url(#goldRing)", track = "rgba(255,255,255,.08)", text = "#fff", sub = "rgba(255,255,255,.75)" }: { score: number; color?: string; track?: string; text?: string; sub?: string }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 180 180" className="h-44 w-44" role="img" aria-label={`Score ${score} out of 100`}>
      <defs>
        <linearGradient id="goldRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd65c" />
          <stop offset="1" stopColor="#e09a12" />
        </linearGradient>
      </defs>
      <circle cx="90" cy="90" r={r} fill="none" stroke={track} strokeWidth="14" />
      <circle cx="90" cy="90" r={r} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 90 90)" />
      <text x="90" y="92" textAnchor="middle" fontSize="54" fontWeight="800" fill={text} fontFamily="Inter, sans-serif">{score}</text>
      <text x="90" y="122" textAnchor="middle" fontSize="16" fill={sub} fontFamily="Inter, sans-serif">/100</text>
    </svg>
  );
}
