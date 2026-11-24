"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WEEKDAYS, addDays, exerciseSlug, unitShort, weekStartOf, type WorkoutSession, type PlanDay, type PlannedExercise, type Profile, type ReshuffleSuggestion, type ScoreReport, type WeekMove, type WorkoutPlan } from "@/lib/domain";
import { api, constraintHit, today } from "@/lib/api";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { DATA_CHANGED, notifyDataChanged } from "@/components/coach/actions";
import { ProjectBridge } from "@/components/ProjectBridge";
import { PlanGenerator } from "@/components/plan/PlanGenerator";
import { ErrorNote, ScoreReportCard, Spinner } from "@/components/ui";
import { Icon } from "@/components/Icons";

/** Upload, edit, activate and score plans (unchanged "Manage plans" tab). */
function ManagePlans() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [report, setReport] = useState<ScoreReport | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editingDay, setEditingDay] = useState<PlanDay | null>(null);
  const [dayTitle, setDayTitle] = useState("");
  const [dayNotes, setDayNotes] = useState("");
  const [dayExercises, setDayExercises] = useState<PlannedExercise[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"upload" | "score" | "day" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = plans.find((p) => p.active) ?? null;

  const load = useCallback(async () => {
    try {
      const [ps, pr, scores] = await Promise.all([api.plans(), api.profile(), api.scores("plan")]);
      setPlans(ps);
      setProfile(pr);
      const a = ps.find((p) => p.active);
      setReport(scores.filter((s) => s.planId === a?.id).at(-1) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    if (!name) setName(f.name.replace(/\.(md|txt)$/i, ""));
  };

  const upload = async () => {
    setBusy("upload");
    setError(null);
    try {
      await api.uploadPlan(name || "Uploaded plan", text);
      setText("");
      setName("");
      setShowUpload(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  const editDay = (day: PlanDay) => {
    setEditingDay(day);
    setDayTitle(day.title);
    setDayNotes(day.notes.join("\n"));
    setDayExercises(day.exercises.map((e) => ({ ...e, alternatives: [...e.alternatives] })));
    setError(null);
  };

  const patchExercise = (id: string, patch: Partial<PlannedExercise>) =>
    setDayExercises((items) => items.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addPlannedExercise = () =>
    setDayExercises((items) => [
      ...items,
      { id: crypto.randomUUID(), name: "", alternatives: [], section: "Main", sets: 3, repMin: 8, repMax: 12, unit: "reps", perSide: false, muscle: "other" },
    ]);

  const saveDay = async () => {
    if (!active || !editingDay) return;
    setBusy("day");
    setError(null);
    try {
      const updated = await api.updatePlanDay(active.id, editingDay.day, {
        title: dayTitle.trim(),
        notes: dayNotes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        exercises: dayExercises.map(({ id, name, sets, repMin, repMax }) => ({ id, name: name.trim(), sets, repMin, repMax })),
      });
      setPlans((items) => items.map((p) => (p.id === updated.id ? updated : p)));
      setReport(null);
      setEditingDay(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this day");
    } finally {
      setBusy(null);
    }
  };

  const score = async () => {
    setBusy("score");
    setError(null);
    try {
      setReport(await api.scorePlan());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scoring failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PlanGenerator onSaved={load} />
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{active ? active.goal || "Active plan" : "No plan yet"}</p>
          <h2 className="h-display text-3xl">{active?.name ?? "Workout plan"}</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowUpload((v) => !v)}>
            {showUpload ? "Cancel" : "Upload new plan"}
          </button>
          <button className="btn btn-primary" onClick={score} disabled={!active || busy !== null}>
            {busy === "score" && <Spinner />} Quick score
          </button>
        </div>
      </section>

      <ErrorNote error={error} />

      {showUpload && (
        <div className="card space-y-4">
          <p className="text-sm text-ink-400">
            Upload a <code>.md</code>/<code>.txt</code> plan or paste it. Use <code>## Monday — Title</code> headers and rows like <code>| Bench press | 3 × 8–12 |</code> or <code>- Plank — 2 × 30–45 seconds</code>.
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <input className="input" placeholder="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="btn btn-ghost cursor-pointer">
              Choose file
              <input type="file" accept=".md,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
          <textarea className="input h-64 font-mono text-xs" placeholder="## Monday — Push&#10;| Bench press | 3 × 8–12 |" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-primary" onClick={upload} disabled={text.trim().length < 20 || busy !== null}>
            {busy === "upload" && <Spinner />} Parse & activate
          </button>
        </div>
      )}

      {active && <ProjectBridge kind="plan" onImported={setReport} collapsed={!!report} />}

      {report && <ScoreReportCard report={report} />}

      {active && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.days.map((d) => (
            <div key={d.day} className={`card ${d.isRest ? "opacity-70" : ""}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="t-workout text-2xl text-fg">{d.day}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{d.isRest ? "Recovery" : `${d.exercises.reduce((a, e) => a + e.sets, 0)} sets`}</span>
                  <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => (editingDay?.day === d.day ? setEditingDay(null) : editDay(d))}>
                    {editingDay?.day === d.day ? "Close editor" : "Edit day"}
                  </button>
                </div>
              </div>

              {editingDay?.day === d.day ? (
                <div className="space-y-4 border-t border-ink-700 pt-4">
                  <div>
                    <label className="label" htmlFor={`day-title-${d.day}`}>Workout title</label>
                    <input id={`day-title-${d.day}`} className="input" value={dayTitle} onChange={(e) => setDayTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <p className="label">Exercises</p>
                    {dayExercises.map((e, i) => (
                      <div key={e.id} className="space-y-3 rounded-xl border border-ink-700 bg-ink-800/50 p-3">
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                          <label className="sr-only" htmlFor={`exercise-${e.id}`}>Exercise {i + 1} name</label>
                          <input id={`exercise-${e.id}`} className="input" placeholder="Exercise name" value={e.name} onChange={(event) => patchExercise(e.id, { name: event.target.value })} />
                          </div>
                          <button className="shrink-0 rounded-lg border border-bad/40 px-3 py-2 text-xs text-bad hover:bg-bad/10" onClick={() => setDayExercises((items) => items.filter((x) => x.id !== e.id))} aria-label={`Remove ${e.name || `exercise ${i + 1}`}`}>
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <NumberField id={`${e.id}-sets`} label="Sets" value={e.sets} onChange={(value) => patchExercise(e.id, { sets: value })} />
                          <NumberField id={`${e.id}-min`} label="Min reps" value={e.repMin} onChange={(value) => patchExercise(e.id, { repMin: value })} />
                          <NumberField id={`${e.id}-max`} label="Max reps" value={e.repMax} onChange={(value) => patchExercise(e.id, { repMax: value })} />
                        </div>
                      </div>
                    ))}
                    <button className="btn btn-ghost text-xs" onClick={addPlannedExercise}>+ Add exercise</button>
                  </div>
                  <div>
                    <label className="label" htmlFor={`day-notes-${d.day}`}>Notes for this day</label>
                    <textarea id={`day-notes-${d.day}`} className="input h-20" value={dayNotes} onChange={(e) => setDayNotes(e.target.value)} placeholder="Warm-up, cardio, or other notes" />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={saveDay} disabled={busy !== null || !dayTitle.trim() || dayExercises.some((e) => !e.name.trim() || e.repMax < e.repMin)}>
                      {busy === "day" && <Spinner />} Save day
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditingDay(null)} disabled={busy !== null}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-sm text-volt-bright">{d.title}</p>
                  <ul className="space-y-1.5 text-sm">
                    {d.exercises.map((e) => {
                      const hit = constraintHit(e.name, profile);
                      return (
                        <li key={e.id} className="flex items-start justify-between gap-2">
                          <span className={hit ? "text-warn" : ""}>
                            {hit && <Icon name="alert" size={14} className="mr-1" />}
                            {e.name}
                            <span className="ml-1.5 rounded bg-ink-700 px-1.5 text-[10px] uppercase text-ink-400">{e.muscle}</span>
                          </span>
                          <span className="shrink-0 font-display font-bold text-fg">
                            {e.sets}×{e.repMin}
                            {e.repMax !== e.repMin && `–${e.repMax}`}
                            {e.unit !== "reps" && unitShort(e.unit)}
                          </span>
                        </li>
                      );
                    })}
                    {d.notes.map((n, i) => <li key={i} className="text-xs text-ink-400">{n}</li>)}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {plans.length > 1 && (
        <div className="card">
          <h2 className="h-display mb-3 text-lg">All plans</h2>
          <ul className="divide-y divide-ink-700 text-sm">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span>
                  {p.name} <span className="text-xs text-ink-400">· {new Date(p.createdAt).toLocaleDateString()}</span>
                </span>
                <span className="flex gap-3 text-xs">
                  {p.active ? (
                    <span className="text-good">Active</span>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => api.activatePlan(p.id).then(load)}>
                        Activate
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => api.deletePlan(p.id).then(load)}>
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type="number" min={1} className="input" value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))} />
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <PlanTabs />
    </Suspense>
  );
}

function PlanTabs() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"week" | "manage">("week");
  useCoachContext("Plan", tab === "week" ? "this week" : "managing plans");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-400">Your training week</p>
          <h1 className="t-workout text-fg text-4xl">Plan</h1>
        </div>
        <div role="tablist" className="flex rounded-xl border border-ink-700 p-1">
          {(["week", "manage"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm ${tab === t ? "bg-ink-700 text-fg" : "text-ink-400"}`}>
              {t === "week" ? "This week" : "Manage plans"}
            </button>
          ))}
        </div>
      </div>
      {tab === "week" ? <WeekView initialDay={params.get("day")} /> : <ManagePlans />}
    </div>
  );
}

type Prev = Awaited<ReturnType<typeof api.previous>>;

function WeekView({ initialDay }: { initialDay: string | null }) {
  const [plan, setPlan] = useState<WorkoutPlan | null | undefined>(undefined);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [prev, setPrev] = useState<Prev>({});
  const [open, setOpen] = useState<string | null>(initialDay);
  const [shuffle, setShuffle] = useState<ReshuffleSuggestion | null>(null);
  const [hideShuffle, setHideShuffle] = useState(false);
  const [shuffleBusy, setShuffleBusy] = useState(false);
  const [shuffleError, setShuffleError] = useState<string | null>(null);
  const t = today();
  const ws = weekStartOf(t);

  const load = useCallback(() => {
    api.activePlan().then(setPlan).catch(() => setPlan(null));
    api.reshuffle(t).then(setShuffle).catch(() => setShuffle(null));
    api.sessions({ week: t }).then(setSessions).catch(() => {});
    api.previous(addDays(t, 1)).then(setPrev).catch(() => {});
  }, [t]);
  useEffect(() => {
    load();
    window.addEventListener(DATA_CHANGED, load);
    return () => window.removeEventListener(DATA_CHANGED, load);
  }, [load]);

  if (plan === undefined) return <div className="card">Loading…</div>;
  if (!plan)
    return (
      <div className="card text-center">
        <p>No active plan yet. Finish setup for a starter plan, or paste your own under Manage plans.</p>
        <Link href="/workout/live?day=custom" className="btn btn-ghost mt-4">Start an empty workout</Link>
      </div>
    );

  const applied = shuffle?.applied ?? [];
  const short = (date: string) => new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" });
  const finished = (x: WorkoutSession) => x.status !== "in_progress" && (x.exercises.some((e) => e.sets.some((y) => y.done)) || !!x.durationMin);
  const apply = async (moves: WeekMove[]) => {
    setShuffleBusy(true);
    setShuffleError(null);
    try {
      setShuffle(await api.applyReshuffle(t, moves));
      notifyDataChanged();
    } catch (e) {
      setShuffleError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setShuffleBusy(false);
    }
  };
  // Offer a reshuffle when something was missed and the suggestion differs from what's applied.
  const pending = shuffle && shuffle.missed.length > 0 && !hideShuffle && shuffle.moves.some((m) => !applied.some((a) => a.date === m.date && a.planDay === m.planDay));

  return (
    <div className="space-y-3">
    {pending && shuffle && (
      <section className="card space-y-3 border-warn/50" aria-label="Missed workouts">
        <h2 className="h-display text-lg">Missed {shuffle.missed.map((m) => `${m.day.slice(0, 3)} (${m.title})`).join(", ")}</h2>
        {shuffle.moves.length > 0 && (
          <ul className="space-y-1 text-sm">
            {shuffle.moves.map((m) => (
              <li key={m.date}>
                Do <strong className="text-fg">{m.title}</strong> on {m.date === t ? "today" : short(m.date)} (a rest day), instead of losing it.
              </li>
            ))}
          </ul>
        )}
        {shuffle.skipped.length > 0 && (
          <p className="text-sm text-ink-400">
            No free day left for {shuffle.skipped.map((m) => m.title).join(", ")}. Skip it this week rather than doubling up; your next week starts fresh.
          </p>
        )}
        <ErrorNote error={shuffleError} />
        <div className="flex flex-wrap gap-2">
          {shuffle.moves.length > 0 && (
            <button className="btn btn-primary" disabled={shuffleBusy} onClick={() => apply(shuffle.moves.map(({ date, planDay }) => ({ date, planDay })))}>
              {shuffleBusy && <Spinner />} Reshuffle this week
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setHideShuffle(true)}>
            Not now
          </button>
        </div>
      </section>
    )}
    {applied.length > 0 && (
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        Reshuffled this week: {applied.map((m) => `${m.planDay.slice(0, 3)} → ${short(m.date)}`).join(", ")}.
        <button className="link" disabled={shuffleBusy} onClick={() => apply([])}>
          Undo
        </button>
      </p>
    )}
    <ul className="space-y-2">
      {WEEKDAYS.map((wd, i) => {
        const date = addDays(ws, i);
        const moveHere = applied.find((m) => m.date === date);
        const d = plan.days.find((x) => x.day === (moveHere?.planDay ?? wd));
        const s = sessions.find((x) => x.date === date);
        const done = !!s && finished(s);
        const live = s?.status === "in_progress";
        // This day's own workout done on another date, or moved there by the reshuffle.
        const doneElsewhere = sessions.find((x) => x.date !== date && x.planDay === wd && finished(x));
        const movedTo = applied.find((m) => m.planDay === wd && m.date !== date);
        const status = live
          ? "In progress"
          : done
            ? `Done${s?.durationMin ? ` · ${s.durationMin} min` : ""}`
            : doneElsewhere
              ? `Done ${short(doneElsewhere.date)}`
              : movedTo && !moveHere
                ? `Moved to ${short(movedTo.date)}`
                : d?.isRest || !d
                  ? "Rest"
                  : date === t
                    ? "Today"
                    : date < t
                      ? "Missed"
                      : "Upcoming";
        const tone = live ? "text-pulse" : done ? "text-good" : status === "Missed" ? "text-bad" : status === "Today" ? "text-volt-bright" : "text-ink-400";
        const isOpen = open === wd;
        return (
          <li key={wd} className={`card p-0 ${date === t ? "border-volt/50" : ""}`}>
            <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(isOpen ? null : wd)} aria-expanded={isOpen}>
              <div className="w-14 shrink-0">
                <p className="font-display text-sm font-bold uppercase text-fg">{wd.slice(0, 3)}</p>
                <p className="text-xs text-ink-400">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
              </div>
              <p className="flex-1 truncate font-medium text-fg">
                {d?.isRest || !d ? "Rest day" : d.title}
                {moveHere && <span className="ml-2 text-xs font-normal text-ink-400">moved from {moveHere.planDay.slice(0, 3)}</span>}
              </p>
              <span className={`text-xs ${tone}`}>{status}</span>
              <span className="text-ink-400" aria-hidden>{isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && (
              <div className="border-t border-ink-700 p-4">
                {d && !d.isRest ? (
                  <>
                    <ul className="divide-y divide-ink-700 text-sm">
                      {d.exercises.map((e) => {
                        const last = prev[e.name.toLowerCase()];
                        const best = last?.sets.reduce<(typeof last.sets)[number] | null>((a, x) => (!a || (x.weightKg ?? 0) > (a.weightKg ?? 0) ? x : a), null);
                        return (
                          <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                            <Link href={`/exercises/${exerciseSlug(e.name)}`} className="text-fg hover:underline">{e.name}</Link>
                            <span className="text-right text-ink-400">
                              {e.sets} × {e.repMin}{e.repMax !== e.repMin ? `–${e.repMax}` : ""}{e.unit === "reps" ? "" : ` ${unitShort(e.unit)}`}
                              {best && <span className="block text-xs">last best {best.weightKg != null ? `${best.weightKg} kg` : "BW"} × {best.reps}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {d.notes.length > 0 && <p className="mt-2 text-xs text-ink-400">{d.notes.join(" · ")}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {done && s ? (
                        <Link href={`/workout/summary/${s.id}`} className="btn btn-ghost">See summary</Link>
                      ) : live ? (
                        <Link href="/workout/live" className="btn btn-primary">Resume</Link>
                      ) : (
                        <Link href={`/workout/live?day=${d.day}`} className="btn btn-primary">Start this workout</Link>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-400">Rest and recover. Light walking and stretching help.</p>
                    <Link href="/workout/live?day=custom" className="btn btn-ghost">Start empty workout</Link>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
    </div>
  );
}
