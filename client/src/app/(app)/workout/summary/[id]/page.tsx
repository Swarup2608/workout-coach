"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { WorkoutSummary } from "@/lib/domain";
import { api } from "@/lib/api";
import { useUnits, toDisplay } from "@/lib/units";
import { ErrorNote, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icons";
import { useCoach, useCoachContext } from "@/components/coach/CoachProvider";
import { PromptBox } from "@/components/coach/ChatThread";

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { units } = useUnits();
  const { setOpen } = useCoach();
  const [s, setS] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; source: string } | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useCoachContext(
    "Workout summary",
    s ? `${s.title}: ${s.durationMin ?? "?"} min, ${s.setsDone}/${s.setsPlanned} sets${s.prs.length ? `, PRs on ${s.prs.map((p) => p.exercise).join(", ")}` : ""}` : undefined,
  );

  const getNote = async () => {
    setNoteBusy(true);
    setError(null);
    try {
      const r = await api.coachNote(id);
      if (r.note) setNote(r.note);
      setPrompt(r.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't get a coach note");
    } finally {
      setNoteBusy(false);
    }
  };

  useEffect(() => {
    api
      .summary(id)
      .then(async (r) => {
        setS(r);
        setRpe(r.session.sessionRpe);
        setNotes(r.session.notes);
        setDuration(r.durationMin != null ? String(r.durationMin) : "");
        if (r.session.coachNote) setNote(r.session.coachNote);
        else if (r.session.status !== "in_progress") {
          // Automatic after Finish: AI note with a key; without one, the prompt is ready to copy.
          const st = await api.status().catch(() => null);
          if (st?.aiConnected) getNote();
        }
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    setSaved(false);
    try {
      await api.patchSession(id, { sessionRpe: rpe, notes, durationMin: duration === "" ? null : Number(duration) });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  if (!s) return <div className="card">{error ? <ErrorNote error={error} /> : "Loading…"}</div>;
  const vol = units === "kg" ? s.volumeKg : Math.round(toDisplay(s.volumeKg, units) ?? 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-ink-400">{new Date(s.session.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="t-workout text-fg text-4xl">{s.title} done</h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Time" value={s.durationMin != null ? `${s.durationMin} min` : "–"} hint={s.restMin != null ? `${s.workingMin} lifting · ${s.restMin} resting` : "start to finish"} />
        <Stat label="Sets" value={`${s.setsDone}/${s.setsPlanned}`} hint="done / planned" />
        <Stat label="Volume" value={`${vol.toLocaleString()} ${units}`} hint="weight × reps" />
        <Stat label="Calories" value={s.kcal ? `~${s.kcal}` : "–"} hint="estimate" />
      </section>

      {s.prs.length > 0 && (
        <section className="card border-good/50 motion-safe:animate-[pulse_1.2s_ease-out_1]">
          <h2 className="t-badge flex items-center gap-2 text-xl text-good"><Icon name="trophy" size={22} />New personal record{s.prs.length > 1 ? "s" : ""}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {s.prs.map((p) => (
              <li key={p.exercise + p.kind}>
                <strong className="text-fg">{p.exercise}</strong>: {p.detail}
                <span className="text-ink-400"> ({p.kind === "weight" ? "heaviest weight" : p.kind === "e1rm" ? "best estimated 1-rep max" : "most reps"}, was {p.previous})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="h-display mb-3 text-xl">vs last time</h2>
        <ul className="divide-y divide-ink-700 text-sm">
          {s.exercises.map((e) => (
            <li key={e.name} className="flex items-center gap-3 py-2">
              <span className={`w-6 text-center text-lg ${e.trend === "up" ? "text-good" : e.trend === "down" ? "text-bad" : "text-ink-400"}`} aria-label={e.trend}>
                {e.trend === "up" ? "↑" : e.trend === "down" ? "↓" : e.trend === "new" ? <Icon name="star" size={14} /> : "="}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/exercises/${e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`} className="text-fg hover:underline">
                  {e.name}
                </Link>
                {e.nextTime && <span className="block text-xs text-ink-400">{e.nextTime}</span>}
              </span>
              <span className="text-right text-ink-400">
                {e.bestSet ?? "not done"}
                {e.prevBestSet && <span className="block text-xs">last: {e.prevBestSet}</span>}
              </span>
            </li>
          ))}
          {!s.exercises.length && <li className="py-2 text-ink-400">No exercises in this workout.</li>}
        </ul>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h-display text-xl">Coach note</h2>
          <button className="btn btn-ghost px-3 py-1 text-xs" onClick={getNote} disabled={noteBusy}>
            {noteBusy && <Spinner />} {note?.source === "ai" ? "New coach note" : "Get coach note"}
          </button>
        </div>
        <p className="text-sm">{s.ruleNote}</p>
        {note && (
          <div className="prose-chat rounded-xl border border-ink-700 bg-ink-800 p-3 text-sm">
            <ReactMarkdown>{note.text}</ReactMarkdown>
          </div>
        )}
        {prompt && <PromptBox text={prompt} title="No AI key. Get this note from Claude instead" />}
        <button className="text-xs link" onClick={() => setOpen(true)}>
          Ask the coach about this workout →
        </button>
      </section>

      <section className="card grid gap-4 md:grid-cols-2">
        <fieldset className="md:col-span-2">
          <legend className="label">How hard was it? (RPE 1–10)</legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(rpe === n ? null : n)} className={`h-10 w-10 rounded-lg border text-sm ${rpe === n ? "border-volt bg-volt/15 text-fg" : "border-ink-700"}`}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="dur">Duration (min)</label>
          <input id="dur" type="number" min="0" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <p className="mt-1 text-xs text-ink-400">Fix it if you forgot to press Finish.</p>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" className="input h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" onClick={save}>Save</button>
          {saved && <span className="text-sm text-good">Saved</span>}
        </div>
      </section>

      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-3">
        <Link href="/dashboard" className="btn btn-primary">Back to Today</Link>
        <Link href="/progress" className="btn btn-ghost">See progress</Link>
      </div>
    </div>
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
