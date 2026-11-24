"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDays, trendWeights, weeklyWeightRate, type ProgressData } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { toDisplay, useUnits } from "@/lib/units";
import { ErrorNote } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { Icon } from "@/components/Icons";
import { useCoachContext } from "@/components/coach/CoachProvider";

const RANGES = [30, 90, 365] as const;

export default function ProgressPage() {
  const { units } = useUnits();
  const [range, setRange] = useState<(typeof RANGES)[number]>(90);
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState<string>("");
  const [month, setMonth] = useState(today().slice(0, 7));

  useEffect(() => {
    api.progress(range, today()).then(setData).catch((e) => setError(e.message));
  }, [range]);

  const ex = data?.exercises.find((e) => e.slug === exercise) ?? data?.exercises[0];
  useCoachContext(
    "Progress",
    data ? `${range}-day view: ${data.totals.sessions} sessions${data.bodyweight.length > 1 ? `, bodyweight ${data.bodyweight[0].kg}→${data.bodyweight.at(-1)!.kg} kg` : ""}${ex ? `, looking at ${ex.name}` : ""}` : undefined,
  );

  const w = (kg: number) => toDisplay(kg, units) ?? 0;
  const bw = data?.bodyweight ?? [];
  // Trend weight smooths daily swings; the change and weekly rate come from it, not the raw scale.
  const bwTrend = trendWeights(bw);
  const bwChange = bw.length > 1 ? w(bwTrend.at(-1)!) - w(bwTrend[0]) : null;
  const bwRate = weeklyWeightRate(bw);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-400">
            <Link href="/history" className="hover:text-fg">All sessions →</Link>
          </p>
          <h1 className="t-workout text-fg text-4xl">Progress</h1>
        </div>
        <div role="tablist" className="flex rounded-xl border border-ink-700 p-1">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`rounded-lg px-3 py-1.5 text-sm ${range === r ? "bg-ink-700 text-fg" : "text-ink-400"}`}>
              {r === 365 ? "1 year" : `${r} days`}
            </button>
          ))}
        </div>
      </div>
      <ErrorNote error={error} />
      {!data ? (
        !error && <div className="card">Loading…</div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Workouts" value={String(data.totals.sessions)} hint={`last ${range} days`} />
            <Stat label="Time trained" value={`${Math.floor(data.totals.minutes / 60)}h ${data.totals.minutes % 60}m`} hint="from the workout timer and logs" />
            <Stat label="Volume" value={`${Math.round(w(data.totals.volumeKg)).toLocaleString()} ${units}`} hint="weight × reps" />
            <Stat
              label="This month"
              value={String(data.totals.thisMonth)}
              hint={`${data.totals.lastMonth} last month${data.totals.thisMonth > data.totals.lastMonth ? " ↑" : ""}`}
            />
          </section>

          <section className="card">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="h-display text-xl">Bodyweight</h2>
              {bwChange != null && (
                <span className="text-sm text-ink-400">
                  Trend {bwChange > 0 ? "+" : ""}
                  {Math.round(bwChange * 10) / 10} {units} over {range === 365 ? "the year" : `${range} days`}
                  {bwRate != null && ` · ${bwRate > 0 ? "+" : bwRate < 0 ? "−" : ""}${w(Math.abs(bwRate))} ${units}/week lately`}
                </span>
              )}
            </div>
            <LineChart label="Bodyweight" unit={units} points={bw.map((p) => ({ date: p.date, value: w(p.kg) }))} trend={bwTrend.map(w)} />
            {bw.length > 1 && <p className="mt-2 text-xs text-ink-400">Dots are your weigh-ins; the line is your trend weight, which smooths out day-to-day water and food swings.</p>}
            {bw.length < 2 && (
              <p className="mt-2 text-xs text-ink-400">
                Add your weight in the <Link href="/checkin" className="link">daily check-in</Link> to see the trend.
              </p>
            )}
          </section>

          <section className="card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="h-display text-xl">Strength</h2>
              {data.exercises.length > 0 && (
                <select className="input w-auto" value={ex?.slug ?? ""} onChange={(e) => setExercise(e.target.value)} aria-label="Exercise">
                  {data.exercises.map((e) => (
                    <option key={e.slug} value={e.slug}>{e.name} ({e.points.length})</option>
                  ))}
                </select>
              )}
            </div>
            {ex ? (
              <>
                <LineChart label={`${ex.name} estimated 1-rep max`} unit={units} points={ex.points.map((p) => ({ date: p.date, value: w(p.e1rm), note: p.best }))} />
                <p className="mt-1 text-xs text-ink-400">
                  Estimated 1-rep max from your best set each session.{" "}
                  <Link href={`/exercises/${ex.slug}`} className="link">Exercise detail →</Link>
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-400">Log weighted sets to see strength trends.</p>
            )}
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="card">
              <h2 className="h-display mb-3 text-xl">Personal records</h2>
              {data.prs.length ? (
                <ul className="divide-y divide-ink-700 text-sm">
                  {data.prs.slice(0, 10).map((p, i) => (
                    <li key={i} className="flex justify-between gap-3 py-2">
                      <span>
                        <span className="flex items-center gap-1.5 text-fg"><Icon name="trophy" size={16} className="text-good" />{p.exercise}</span>
                        <span className="block text-xs text-ink-400">{p.kind === "weight" ? "Heaviest weight" : p.kind === "e1rm" ? "Best estimated 1RM" : "Most reps"} · {p.date}</span>
                      </span>
                      <span className="text-right">{p.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-400">No records yet. They show up when you beat a previous best.</p>
              )}
            </section>
            <Calendar data={data} month={month} setMonth={setMonth} />
          </div>
        </>
      )}
    </div>
  );
}

function Calendar({ data, month, setMonth }: { data: ProgressData; month: string; setMonth: (m: string) => void }) {
  const byDate = useMemo(() => new Map(data.calendar.map((c) => [c.date, c])), [data]);
  const first = `${month}-01`;
  const offset = (new Date(first + "T00:00:00Z").getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const shift = (n: number) => {
    const d = new Date(first + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const color = (rpe: number | null) => (rpe == null ? "bg-volt/40" : rpe >= 8 ? "bg-pulse/70" : rpe >= 6 ? "bg-volt/70" : "bg-good/60");
  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="h-display text-xl">{new Date(first + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-1">
          <button className="btn btn-ghost px-2 py-1" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <button className="btn btn-ghost px-2 py-1" onClick={() => shift(1)} aria-label="Next month" disabled={month >= today().slice(0, 7)}>›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="text-ink-400">{d}</span>
        ))}
        {Array.from({ length: offset }, (_, i) => <span key={`o${i}`} />)}
        {Array.from({ length: daysIn }, (_, i) => {
          const date = addDays(first, i);
          const c = byDate.get(date);
          return (
            <span
              key={date}
              title={c ? `${date}: ${c.title}${c.durationMin ? `, ${c.durationMin} min` : ""}${c.rpe ? `, RPE ${c.rpe}` : ""}` : date}
              className={`flex aspect-square items-center justify-center rounded-md ${c ? `${color(c.rpe)} font-bold text-fg` : "bg-ink-800 text-ink-400"} ${date === today() ? "ring-1 ring-volt-bright" : ""}`}
            >
              {i + 1}
            </span>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-400">Filled = trained. Colour shows effort: green easy, blue moderate, orange hard. Only days in the selected range are shown.</p>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-2xl font-bold text-fg">{value}</p>
      <p className="text-xs text-ink-400">{hint}</p>
    </div>
  );
}
