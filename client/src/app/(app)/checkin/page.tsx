"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, type Checkin } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { CheckinCard, ReadinessChip, READINESS_STYLE } from "@/components/CheckinCard";
import { ErrorNote } from "@/components/ui";
import { useCoachContext } from "@/components/coach/CoachProvider";

/** Full-size daily check-in: edit today's answers and see the last 14 days. */
export default function CheckinPage() {
  const [todayC, setTodayC] = useState<Checkin | null | undefined>(undefined);
  const [history, setHistory] = useState<Checkin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const t = today();
  useCoachContext("Daily check-in", todayC?.readiness ? `readiness ${todayC.readiness.score} (${todayC.readiness.label})` : undefined);

  const load = useCallback(() => {
    api.checkin(t).then(setTodayC).catch((e) => setError(e.message));
    api.checkins(addDays(t, -13), t).then(setHistory).catch(() => {});
  }, [t]);
  useEffect(load, [load]);

  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13));
  const byDate = new Map(history.map((c) => [c.date, c]));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-ink-400">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="t-workout text-fg text-4xl">Daily check-in</h1>
      </div>

      {todayC?.readiness && (
        <div className="card space-y-2">
          <ReadinessChip r={todayC.readiness} />
          <p className="text-sm">{todayC.readiness.advice}</p>
        </div>
      )}

      {todayC !== undefined && <CheckinCard key={todayC?.updatedAt ?? "new"} large initial={todayC} onSaved={() => load()} />}
      <ErrorNote error={error} />

      <section className="card">
        <h2 className="h-display mb-3 text-xl">Last 14 days</h2>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const c = byDate.get(d);
            return (
              <div
                key={d}
                className={`rounded-lg border p-2 text-center text-xs ${c?.readiness ? READINESS_STYLE[c.readiness.band] : c ? "border-ink-600" : "border-ink-700 text-ink-400"}`}
                title={c?.readiness ? `${d}: ${c.readiness.label}` : d}
              >
                <p>{new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</p>
                <p className="font-display text-sm font-bold">{c?.readiness?.score ?? (c ? "✓" : "·")}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-400">Number = readiness score (needs two or more answers). Green: ready to push · blue: train as planned · amber: go lighter.</p>
      </section>
    </div>
  );
}
