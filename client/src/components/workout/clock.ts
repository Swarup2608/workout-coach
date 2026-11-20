"use client";

import { useEffect, useState } from "react";
import { sessionElapsedMs, type WorkoutSession } from "@/lib/domain";

/** "1:02:05" or "18:42". */
export function fmtClock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Re-renders every second; the time itself always comes from the timestamps. */
export function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);
  return now;
}

/** Elapsed active time of a session, computed from startedAt / pausedMs, so reloads never lose it. */
export function useElapsed(s: Pick<WorkoutSession, "startedAt" | "endedAt" | "pausedMs" | "pausedAt"> | null) {
  const now = useNow(!!s?.startedAt && !s.endedAt && !s.pausedAt);
  return s ? sessionElapsedMs(s, now) : 0;
}
