"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { WorkoutSession } from "@/lib/domain";
import { api } from "@/lib/api";
import { fmtClock, useElapsed } from "./clock";

/** "● 18:42 Resume" in the header on every page while a workout is running. */
export function LivePill() {
  const path = usePathname();
  const [live, setLive] = useState<WorkoutSession | null>(null);
  useEffect(() => {
    api.liveSession().then((r) => setLive(r.session)).catch(() => setLive(null));
  }, [path]);
  const elapsed = useElapsed(live);
  if (!live || path.startsWith("/workout/live")) return null;
  return (
    <Link href="/workout/live" className="flex items-center gap-2 rounded-full border border-pulse/50 bg-pulse/10 px-3 py-1 text-xs font-medium text-fg hover:border-pulse">
      <span className={`h-2 w-2 rounded-full bg-pulse ${live.pausedAt ? "" : "animate-pulse"}`} aria-hidden />
      <span className="tabular-nums">{fmtClock(elapsed)}</span>
      <span>{live.pausedAt ? "Paused" : "Resume"}</span>
    </Link>
  );
}
