"use client";

import { useCallback, useEffect, useState } from "react";
import { unitShort, type PlanDay, type PlannedExercise, type Profile, type ScoreReport, type WorkoutPlan } from "@/lib/domain";
import { api, constraintHit } from "@/lib/api";
import { ProjectBridge } from "@/components/ProjectBridge";
import { ErrorNote, ScoreReportCard, Spinner } from "@/components/ui";

export default function PlanPage() {
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
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">{active ? active.goal || "Active plan" : "No plan yet"}</p>
          <h1 className="h-display text-4xl">{active?.name ?? "Workout plan"}</h1>
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
                <h3 className="h-display text-xl">{d.day}</h3>
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
                            {hit && "⚠ "}
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
                      <button className="text-volt-bright hover:underline" onClick={() => api.activatePlan(p.id).then(load)}>
                        Activate
                      </button>
                      <button className="text-ink-400 hover:text-bad" onClick={() => api.deletePlan(p.id).then(load)}>
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
