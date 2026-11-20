"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { setLabel } from "@/lib/domain";
import { api } from "@/lib/api";
import { toDisplay, useUnits } from "@/lib/units";
import { ErrorNote } from "@/components/ui";
import { LineChart } from "@/components/LineChart";
import { Icon } from "@/components/Icons";
import { useCoach, useCoachContext } from "@/components/coach/CoachProvider";

type Detail = Awaited<ReturnType<typeof api.exercise>>;

export default function ExerciseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { units } = useUnits();
  const { setOpen } = useCoach();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useCoachContext("Exercise detail", d?.exercise.name);

  useEffect(() => {
    setD(null);
    api.exercise(slug).then(setD).catch((e) => setError(e.message));
  }, [slug]);

  if (!d) return <div className="card">{error ? <ErrorNote error={error} /> : "Loading…"}</div>;
  const e = d.exercise;
  const isWeighted = d.series.some((p) => p.best.includes("kg"));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/exercises" className="link text-sm">← All exercises</Link>

      <div className="card grid gap-5 p-0 md:grid-cols-[320px_1fr]">
        <Image src={e.image} alt={e.name} width={640} height={480} priority className="h-56 w-full rounded-t-2xl object-cover md:h-full md:rounded-l-2xl md:rounded-tr-none" style={{ filter: "var(--photo-filter)" }} />
        <div className="space-y-3 p-5 md:pl-0">
          <h1 className="t-workout text-fg text-3xl">{e.name}</h1>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-volt/15 px-2.5 py-1 capitalize text-volt-bright">{e.muscle}</span>
            {e.secondary.map((m) => (
              <span key={m} className="rounded-full bg-ink-800 px-2.5 py-1 capitalize text-ink-400">{m}</span>
            ))}
            {e.level && <span className="rounded-full border border-ink-700 px-2.5 py-1 capitalize">{e.level}</span>}
          </div>
          <p className="text-sm text-ink-400">
            Rest {d.restSec}s between sets{e.equipment.length ? ` · ${e.equipment.map((x) => x.replace("_", " ")).join(", ")}` : ""}
          </p>
          {d.injuryWarning.length > 0 && (
            <p className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm" role="alert">
              <Icon name="alert" size={16} className="mr-1.5" />This exercise loads your {d.injuryWarning.map((i) => i.replace("_", " ")).join(" and ")}, which you listed as an injury. Try an alternative below or ask the coach.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={e.youtubeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary gap-2"><Icon name="play" size={16} />Watch on YouTube</a>
            <button className="btn btn-ghost" onClick={() => setOpen(true)}>Ask coach about this</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="h-display mb-3 text-xl">How to do it</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {e.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
          {!e.builtIn && <p className="mt-3 text-xs text-ink-400">General guidance. This exercise comes from your own plan or log, so watch the video for specifics.</p>}
        </section>
        <section className="card space-y-4">
          <div>
            <h2 className="h-display mb-2 text-xl">Form cues</h2>
            <ul className="space-y-1 text-sm">{e.cues.map((c) => <li key={c}>✓ {c}</li>)}</ul>
          </div>
          <div>
            <h2 className="h-display mb-2 text-xl">Common mistakes</h2>
            <ul className="space-y-1 text-sm text-ink-400">{e.mistakes.map((c) => <li key={c}>✕ {c}</li>)}</ul>
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="h-display mb-3 text-xl">Your history</h2>
        {d.history.length ? (
          <>
            <LineChart
              label={`${e.name} ${isWeighted ? "estimated 1-rep max" : "best reps"}`}
              unit={isWeighted ? units : "reps"}
              points={d.series.map((p) => ({ date: p.date, value: isWeighted ? (toDisplay(p.e1rm, units) ?? 0) : p.e1rm, note: p.best }))}
            />
            <p className="mt-1 text-xs text-ink-400">{isWeighted ? "Estimated 1-rep max per session (from your best set)." : "Best reps per session."}</p>
            <ul className="mt-4 divide-y divide-ink-700 text-sm">
              {d.history.slice(0, 5).map((h) => (
                <li key={h.date} className="flex justify-between gap-3 py-2">
                  <span className="text-ink-400">{h.date}</span>
                  <span className="text-right">{h.sets.map((s) => setLabel(s, h.unit)).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-400">You haven&apos;t logged this one yet.</p>
        )}
      </section>

      {d.alternatives.length > 0 && (
        <section>
          <h2 className="h-display mb-3 text-xl">Alternatives that fit your setup</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.alternatives.map((a) => (
              <li key={a.slug}>
                <Link href={`/exercises/${a.slug}`} className="card block p-3 hover:border-volt">
                  <p className="font-medium text-fg">{a.name}</p>
                  <p className="text-xs capitalize text-ink-400">{a.muscle}{a.level ? ` · ${a.level}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
