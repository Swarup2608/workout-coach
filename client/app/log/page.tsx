"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CARDIO_TYPES,
  EQUIPMENT,
  MEALS,
  exerciseVolume,
  guessEquipment,
  type Equipment,
  REP_UNITS,
  addDays,
  cardioKcal,
  foodTotals,
  stepsKcal,
  type FoodEntry,
  type Meal,
  type CardioEntry,
  type CardioType,
  estimateKcal,
  swapsFor,
  unitShort,
  weekdayOf,
  weekStartOf,
  type LoggedSet,
  type PlannedExercise,
  type Profile,
  type RepUnit,
  type Weekday,
  type WorkoutPlan,
  type WorkoutSession,
} from "@workout/shared";
import { api, constraintHit, today } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { QuickAdd } from "@/components/QuickAdd";

interface DraftExercise {
  key: string;
  plannedId: string | null;
  name: string;
  unit: RepUnit;
  equipment: Equipment;
  perSide: boolean;
  notes: string;
  showNote: boolean;
  planned?: PlannedExercise;
  sets: LoggedSet[];
}

type Prev = Awaited<ReturnType<typeof api.previous>>;

const emptySet = (): LoggedSet => ({ weightKg: null, reps: null, done: false });
const uid = () => Math.random().toString(36).slice(2);
const numOrNull = (v: string) => (v === "" ? null : Number(v));
const target = (p: PlannedExercise) =>
  `${p.sets} × ${p.repMin}${p.repMax !== p.repMin ? `–${p.repMax}` : ""}${p.unit === "reps" ? "" : ` ${unitShort(p.unit)}`}${p.perSide ? " each" : ""}`;

export default function LogPage() {
  const [date, setDate] = useState(today());
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prev, setPrev] = useState<Prev>({});
  const [week, setWeek] = useState<WorkoutSession[]>([]);
  const [existing, setExisting] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [cardio, setCardio] = useState<CardioEntry[]>([]);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [steps, setSteps] = useState<number | null>(null);
  const [waterL, setWaterL] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<number | null>(null);
  /** Which plan day's workout is being done on this date (one-day change; plan itself is untouched) */
  const [workoutDay, setWorkoutDay] = useState<Weekday | "custom">(weekdayOf(today()));
  const [title, setTitle] = useState("");
  const { confirm, dialog } = useConfirm();
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [quickAddClearSignal, setQuickAddClearSignal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const day = weekdayOf(date);
  const planDay = plan?.days.find((d) => d.day === day);
  const allPlanned = useMemo(() => plan?.days.flatMap((d) => d.exercises) ?? [], [plan]);

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDate(d);
    Promise.all([api.activePlan(), api.profile()])
      .then(([p, pr]) => {
        setPlan(p);
        setProfile(pr);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadDate = useCallback(async () => {
    if (!plan) return;
    setSavedAt(null);
    try {
      const [sessions, previous, wk] = await Promise.all([api.sessions({ date }), api.previous(date), api.sessions({ week: date })]);
      setPrev(previous);
      setWeek(wk);
      const s = sessions[0] ?? null;
      setExisting(s);
      if (s) {
        setExercises(
          s.exercises.map((e) => ({
            key: uid(),
            plannedId: e.plannedId,
            name: e.name,
            unit: e.unit,
            equipment: e.equipment ?? guessEquipment(e.name),
            perSide: e.perSide ?? false,
            notes: e.notes ?? "",
            showNote: !!e.notes,
            planned: allPlanned.find((p) => p.id === e.plannedId),
            sets: e.sets,
          })),
        );
        setWorkoutDay(s.planDay ?? s.day);
        setTitle(s.title ?? "");
        setDuration(s.durationMin ?? null);
        setRpe(s.sessionRpe);
        // Older logs only had total minutes: show them as one "other" row.
        setCardio(s.cardio?.length ? s.cardio : s.cardioMinutes ? [{ type: "other", minutes: s.cardioMinutes }] : []);
        setBodyweight(s.bodyweightKg);
        setNotes(s.notes);
        setFood(s.food ?? []);
        setSteps(s.steps ?? null);
        setWaterL(s.waterL ?? null);
        setSleepHours(s.sleepHours ?? null);
      } else {
        fillFromPlan(plan, date);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [date, plan, allPlanned]);

  /** Empty-set template for a plan day's exercises ("custom" = start blank). */
  const exercisesFrom = (p: WorkoutPlan, source: Weekday | "custom"): DraftExercise[] =>
    source === "custom"
      ? []
      : (p.days.find((x) => x.day === source)?.exercises ?? []).map((pe) => ({
          key: uid(),
          plannedId: pe.id,
          name: pe.alternatives[0] ?? pe.name,
          unit: pe.unit,
          equipment: guessEquipment(pe.alternatives[0] ?? pe.name),
          perSide: pe.perSide,
          notes: "",
          showNote: false,
          planned: pe,
          sets: Array.from({ length: pe.sets }, emptySet),
        }));

  /** Blank form for the day: that weekday's planned exercises with empty sets, nothing else filled in. */
  function fillFromPlan(p: WorkoutPlan, d: string) {
    setExercises(exercisesFrom(p, weekdayOf(d)));
    setWorkoutDay(weekdayOf(d));
    setTitle("");
    setDuration(null);
    setRpe(null);
    setCardio([]);
    setBodyweight(null);
    setNotes("");
    setFood([]);
    setSteps(null);
    setWaterL(null);
    setSleepHours(null);
    setNewName("");
  }

  useEffect(() => {
    loadDate();
  }, [loadDate]);

  const patch = (key: string, fn: (e: DraftExercise) => DraftExercise) => setExercises((xs) => xs.map((x) => (x.key === key ? fn(x) : x)));
  const patchSet = (key: string, i: number, p: Partial<LoggedSet>) =>
    patch(key, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === i ? { ...s, ...p, done: p.done ?? (s.done || (p.reps != null && p.reps > 0)) } : s)) }));

  const addExercise = () => {
    const name = newName.trim();
    if (!name) return;
    const p = allPlanned.find((x) => x.name.toLowerCase() === name.toLowerCase());
    setExercises((xs) => [
      ...xs,
      { key: uid(), plannedId: p?.id ?? null, name, unit: p?.unit ?? "reps", equipment: guessEquipment(name), perSide: p?.perSide ?? false, notes: "", showNote: false, planned: p, sets: Array.from({ length: p?.sets ?? 3 }, emptySet) },
    ]);
    setNewName("");
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const s = await api.saveSession({
        date,
        planDay: workoutDay,
        title: title.trim(),
        exercises: exercises.map(({ plannedId, name, unit, equipment, perSide, notes, sets }) => ({ plannedId, name, unit, equipment, perSide, notes: notes.trim(), sets })),
        durationMin: duration,
        sessionRpe: rpe,
        cardio: cardio.filter((c) => c.minutes || c.distanceKm),
        cardioMinutes: null,
        bodyweightKg: bodyweight,
        food: food.filter((f) => f.name.trim()).map((f) => ({ ...f, name: f.name.trim() })),
        steps: steps == null ? null : Math.round(steps),
        waterL,
        sleepHours,
        notes: notes.trim(),
      });
      setExisting(s);
      setSavedAt(new Date().toLocaleTimeString());
      setQuickAddClearSignal((n) => n + 1);
      setWeek(await api.sessions({ week: date }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /** Clear everything for this day and go back to the plan's empty template. */
  const resetDay = async () => {
    if (!plan) return;
    const ok = await confirm({
      title: `Reset ${day}, ${date}?`,
      body: existing ? (
        <>
          This <strong className="text-white">deletes the saved workout</strong> for this day (sets, cardio, notes and Claude&apos;s calories) and brings back {day}&apos;s plan
          with empty sets.
        </>
      ) : (
        <>Clears everything you&apos;ve entered for this day and brings back {day}&apos;s plan with empty sets.</>
      ),
      confirmLabel: existing ? "Delete & reset" : "Clear",
      tone: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      if (existing) {
        await api.deleteSession(existing.id);
        setExisting(null);
        setWeek(await api.sessions({ week: date }));
      }
      fillFromPlan(plan, date);
      setSavedAt(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  };

  const doneSets = exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
  const volume = exercises.reduce((a, e) => a + exerciseVolume(e), 0);
  const kcal = existing?.kcalClaude ?? estimateKcal({ exercises, durationMin: duration, cardio, cardioMinutes: null, sessionRpe: rpe, bodyweightKg: bodyweight }, profile?.startBodyweightKg ?? null);
  const kg = bodyweight ?? profile?.startBodyweightKg ?? 75;
  const patchCardio = (i: number, p: Partial<CardioEntry>) => setCardio((xs) => xs.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const addCardio = (type: CardioType) => setCardio((xs) => [...xs, { type, minutes: null }]);
  const patchFood = (i: number, p: Partial<FoodEntry>) => setFood((xs) => xs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const eaten = foodTotals(food);

  /** After an AI import: jump to that date (or reload this one) so the form shows what was saved. */
  const onImported = (s: WorkoutSession) => {
    if (s.date !== date) setDate(s.date);
    else loadDate();
    setSavedAt(new Date().toLocaleTimeString());
  };
  const ws = weekStartOf(date);
  const hasEntries = exercises.some((e) => e.sets.some((s) => s.weightKg != null || s.reps != null || s.done) || e.notes);
  const chosenTitle = workoutDay === "custom" ? title || "Custom workout" : (title || plan?.days.find((d) => d.day === workoutDay)?.title) ?? "Rest";

  /** Do a different workout on this date only. Keeps cardio, notes and session details. */
  const changeWorkout = async (next: Weekday | "custom") => {
    if (!plan || next === workoutDay) return;
    if (hasEntries) {
      const ok = await confirm({
        title: "Change today's workout?",
        body: (
          <>
            The sets you&apos;ve entered will be replaced by{" "}
            <strong className="text-white">{next === "custom" ? "a blank workout you build yourself" : `${next}'s ${plan.days.find((d) => d.day === next)?.title ?? "workout"}`}</strong>. Cardio and
            notes stay. Your weekly plan doesn&apos;t change.
          </>
        ),
        confirmLabel: "Change workout",
      });
      if (!ok) return;
    }
    setExercises(exercisesFrom(plan, next));
    setWorkoutDay(next);
    setTitle("");
  };

  if (!plan) return <div className="card">{error ? <ErrorNote error={error} /> : "Loading plan…"}</div>;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-400">
            {day} · {chosenTitle}
            {workoutDay !== day && <span className="ml-2 rounded-full bg-volt/20 px-2 py-0.5 text-[11px] text-volt-bright">changed for today</span>}
          </p>
          <h1 className="h-display text-4xl">Log workout</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ←
          </button>
          <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn btn-ghost" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
            →
          </button>
        </div>
      </section>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => {
          const logged = week.some((s) => s.date === d);
          const rest = plan.days.find((x) => x.day === weekdayOf(d))?.isRest;
          return (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`rounded-xl border px-2 py-2 text-center text-xs transition ${d === date ? "border-volt bg-volt/15 text-white" : logged ? "border-good/50 text-good" : "border-ink-700 text-ink-400 hover:border-ink-500"}`}
            >
              <div className="font-display text-sm font-bold uppercase">{weekdayOf(d).slice(0, 3)}</div>
              <div>{d.slice(8)}</div>
              <div className="mt-0.5">{logged ? "✓" : rest ? "rest" : "·"}</div>
            </button>
          );
        })}
      </div>

      {dialog}

      <QuickAdd date={date} onImported={onImported} clearSignal={quickAddClearSignal} />

      {/* One-day workout change */}
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="workout">
            Today&apos;s workout
          </label>
          <select id="workout" className="input w-auto" value={workoutDay} onChange={(e) => changeWorkout(e.target.value as Weekday | "custom")}>
            {plan.days.map((d) => (
              <option key={d.day} value={d.day} disabled={d.isRest && d.day !== day}>
                {d.day === day ? "As planned: " : `${d.day}'s: `}
                {d.isRest ? "Rest" : d.title}
              </option>
            ))}
            <option value="custom">My own workout…</option>
          </select>
        </div>
        {workoutDay !== day && (
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="wtitle">
              Name it (optional)
            </label>
            <input
              id="wtitle"
              className="input"
              placeholder={workoutDay === "custom" ? "e.g. Back & biceps" : plan.days.find((d) => d.day === workoutDay)?.title}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        )}
        <p className="w-full text-xs text-ink-400">
          {workoutDay === day
            ? "Feel like something else? Pick another day's workout or build your own. It only changes this date; your weekly plan stays the same."
            : workoutDay === "custom"
              ? "Add your own exercises below. Only this date changes, and Claude is told you went off-plan."
              : `Doing ${workoutDay}'s workout today. Only this date changes, and Claude is told about the change.`}
        </p>
      </div>

      <ErrorNote error={error} />

      {workoutDay === "custom" && exercises.length === 0 && (
        <div className="card text-sm text-ink-400">Your own workout: add exercises with the box below (e.g. “Lat pulldown”, “Barbell row”, “Hammer curls”).</div>
      )}

      {workoutDay === day && planDay?.isRest && exercises.length === 0 && (
        <div className="card text-sm">
          Recovery day in your plan. {planDay.notes[0] ?? "Walking, mobility or full rest."} You can still log cardio below or add exercises.
        </div>
      )}

      <div className="space-y-4">
        {exercises.map((e, idx) => {
          const hit = constraintHit(e.name, profile);
          const p = prev[e.name.toLowerCase()];
          const options = e.planned?.alternatives.length ? e.planned.alternatives : null;
          const unitLabel = REP_UNITS.find((u) => u.value === e.unit)?.label ?? "Reps";
          const offPlanUnit = e.planned && e.planned.unit !== e.unit;
          const kgMeans = EQUIPMENT.find((x) => x.value === e.equipment)?.kgMeans ?? "kg";
          const kgHeader = { barbell: "kg total", dumbbell: "kg / db", cable: "kg stack", machine: "kg", bodyweight: "+kg", other: "kg" }[e.equipment];
          return (
            <div key={e.key} className="card">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">
                    {idx + 1}. {e.planned?.section ?? "Extra"} {e.planned && <>· target {target(e.planned)}</>}
                  </p>
                  {options ? (
                    <select className="input mt-1 w-auto font-semibold" value={e.name} onChange={(ev) => patch(e.key, (x) => ({ ...x, name: ev.target.value }))}>
                      {options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="h-display text-xl">{e.name}</h3>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <select
                    className="input w-auto py-1 text-xs"
                    value={e.equipment}
                    onChange={(ev) => patch(e.key, (x) => ({ ...x, equipment: ev.target.value as Equipment }))}
                    aria-label={`Equipment for ${e.name}`}
                    title={`kg = ${kgMeans}`}
                  >
                    {EQUIPMENT.map((q) => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-ink-400" title="One arm/leg at a time: reps counted per side">
                    <input type="checkbox" className="accent-[var(--color-volt)]" checked={e.perSide} onChange={(ev) => patch(e.key, (x) => ({ ...x, perSide: ev.target.checked }))} />
                    Each side
                  </label>
                  <label className="flex items-center gap-1.5 text-ink-400">
                    Measure
                    <select
                      className="input w-auto py-1 text-xs"
                      value={e.unit}
                      onChange={(ev) => patch(e.key, (x) => ({ ...x, unit: ev.target.value as RepUnit }))}
                      aria-label={`Measure ${e.name} in`}
                    >
                      {REP_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={e.showNote ? "text-volt-bright" : "text-ink-400 hover:text-white"} onClick={() => patch(e.key, (x) => ({ ...x, showNote: !x.showNote }))}>
                    {e.notes ? "✎ Note" : "+ Note"}
                  </button>
                  <button className="text-ink-400 hover:text-bad" onClick={() => setExercises((xs) => xs.filter((x) => x.key !== e.key))}>
                    Remove
                  </button>
                </div>
              </div>

              {hit && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                  <span>⚠ Conflicts with “{hit.label}”. Swap:</span>
                  {swapsFor(e.name, hit).slice(0, 3).map((s) => (
                    <button key={s} className="rounded-full border border-warn/50 px-2 py-0.5 hover:bg-warn/20" onClick={() => patch(e.key, (x) => ({ ...x, name: s }))}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <tr>
                      <th className="w-10 pb-2">Set</th>
                      <th className="pb-2">Previous</th>
                      <th className="w-28 pb-2" title={`kg = ${kgMeans}`}>
                        {kgHeader}
                      </th>
                      <th className="w-28 pb-2">
                        {unitLabel}
                        {e.perSide && e.unit === "reps" ? " / side" : ""}
                      </th>
                      {e.unit === "reps" && (
                        <th className="w-20 pb-2" title="Negative-only (eccentric) reps after the full reps">
                          Neg
                        </th>
                      )}
                      <th className="w-12 pb-2 text-center">✓</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {e.sets.map((s, i) => {
                      const ps = p?.sets[i];
                      return (
                        <tr key={i} className={s.done ? "text-white" : ""}>
                          <td className="py-1 font-display text-base font-bold">{i + 1}</td>
                          <td className="py-1 text-xs text-ink-400">{ps ? `${ps.weightKg ?? "BW"} × ${ps.reps}${ps.negatives ? ` +${ps.negatives}n` : ""}` : "—"}</td>
                          <td className="py-1 pr-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="0"
                              className="input"
                              placeholder={ps?.weightKg != null ? String(ps.weightKg) : "BW"}
                              value={s.weightKg ?? ""}
                              onChange={(ev) => patchSet(e.key, i, { weightKg: numOrNull(ev.target.value) })}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              className="input"
                              placeholder={
                                ps?.reps != null
                                  ? String(ps.reps)
                                  : e.planned && !offPlanUnit
                                    ? e.planned.repMin === e.planned.repMax
                                      ? String(e.planned.repMin)
                                      : `${e.planned.repMin}–${e.planned.repMax}`
                                    : unitShort(e.unit)
                              }
                              value={s.reps ?? ""}
                              onChange={(ev) => patchSet(e.key, i, { reps: numOrNull(ev.target.value) })}
                            />
                          </td>
                          {e.unit === "reps" && (
                            <td className="py-1 pr-2">
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                className="input"
                                placeholder="0"
                                value={s.negatives ?? ""}
                                onChange={(ev) => patchSet(e.key, i, { negatives: numOrNull(ev.target.value) })}
                                aria-label={`Set ${i + 1} negative reps`}
                              />
                            </td>
                          )}
                          <td className="py-1 text-center">
                            <input type="checkbox" className="h-5 w-5 accent-[var(--color-good)]" checked={s.done} onChange={(ev) => patchSet(e.key, i, { done: ev.target.checked })} aria-label={`Set ${i + 1} done`} />
                          </td>
                          <td className="py-1 text-right">
                            <button className="text-ink-400 hover:text-bad" onClick={() => patch(e.key, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))} aria-label="Remove set">
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {e.showNote && (
                <input
                  className="input mt-3 text-sm"
                  placeholder="Note for this exercise: form, pain, seat height, felt easy…"
                  value={e.notes}
                  onChange={(ev) => patch(e.key, (x) => ({ ...x, notes: ev.target.value }))}
                  autoFocus={!e.notes}
                />
              )}

              <div className="mt-2 flex gap-3 text-xs">
                <button className="text-volt-bright hover:underline" onClick={() => patch(e.key, (x) => ({ ...x, sets: [...x.sets, emptySet()] }))}>
                  + Add set
                </button>
                {p && (
                  <button
                    className="text-ink-400 hover:text-white"
                    onClick={() => patch(e.key, (x) => ({ ...x, sets: x.sets.map((s, i) => (p.sets[i] ? { weightKg: p.sets[i].weightKg, reps: p.sets[i].reps, negatives: p.sets[i].negatives ?? null, done: false } : s)) }))}
                  >
                    Copy last session ({p.date})
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card flex flex-wrap gap-2">
        <input
          className="input flex-1"
          list="exercise-options"
          placeholder="Add an exercise (from your plan or custom)…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addExercise()}
        />
        <datalist id="exercise-options">
          {[...new Set(allPlanned.map((p) => p.name))].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        <button className="btn btn-ghost" onClick={addExercise}>
          Add
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h-display text-lg">
            Cardio <span className="text-sm font-normal text-ink-400">(optional)</span>
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {(["incline walk", "cycling", "other"] as CardioType[]).map((t) => (
              <button key={t} className="rounded-full border border-ink-600 px-3 py-1 text-ink-200 hover:border-volt hover:text-white" onClick={() => addCardio(t)}>
                + {t === "other" ? "Other" : t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {cardio.length === 0 && <p className="text-xs text-ink-400">Add incline walking, cycling or other cardio you did today.</p>}
        {cardio.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="pb-2">Type</th>
                  <th className="w-24 pb-2">Minutes</th>
                  <th className="w-24 pb-2">km/h</th>
                  <th className="w-24 pb-2">Incline %</th>
                  <th className="w-24 pb-2">Level</th>
                  <th className="w-24 pb-2">km</th>
                  <th className="w-16 pb-2 text-right">kcal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {cardio.map((c, i) => {
                  const walkish = c.type === "incline walk" || c.type === "running";
                  return (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <select className="input" value={c.type} onChange={(e) => patchCardio(i, { type: e.target.value as CardioType })} aria-label="Cardio type">
                          {CARDIO_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t[0].toUpperCase() + t.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" inputMode="decimal" min="0" step="0.5" className="input" placeholder="15" value={c.minutes ?? ""} onChange={(e) => patchCardio(i, { minutes: numOrNull(e.target.value) })} aria-label="Minutes" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" inputMode="decimal" min="0" step="0.1" className="input" placeholder={walkish ? "3.5" : "–"} value={c.speedKmh ?? ""} onChange={(e) => patchCardio(i, { speedKmh: numOrNull(e.target.value) })} aria-label="Speed km/h" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" inputMode="decimal" min="0" step="0.5" className="input" placeholder={walkish ? "12" : "–"} value={c.inclinePct ?? ""} onChange={(e) => patchCardio(i, { inclinePct: numOrNull(e.target.value) })} aria-label="Incline percent" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" inputMode="numeric" min="0" className="input" placeholder={walkish ? "–" : "8"} value={c.level ?? ""} onChange={(e) => patchCardio(i, { level: numOrNull(e.target.value) })} aria-label="Resistance level" />
                      </td>
                      <td className="py-1 pr-2">
                        <input type="number" inputMode="decimal" min="0" step="0.01" className="input" placeholder="–" value={c.distanceKm ?? ""} onChange={(e) => patchCardio(i, { distanceKm: numOrNull(e.target.value) })} aria-label="Distance km" />
                      </td>
                      <td className="py-1 text-right font-display font-bold text-white">{cardioKcal(c, kg) || "–"}</td>
                      <td className="py-1 text-right">
                        <button className="text-ink-400 hover:text-bad" onClick={() => setCardio((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove cardio">
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h-display text-lg">
            Food &amp; day <span className="text-sm font-normal text-ink-400">(optional)</span>
          </h2>
          <button className="rounded-full border border-ink-600 px-3 py-1 text-xs text-ink-200 hover:border-volt hover:text-white" onClick={() => setFood((xs) => [...xs, { name: "", kcal: null }])}>
            + Add food
          </button>
        </div>
        {food.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                <tr>
                  <th className="w-32 pb-2">Meal</th>
                  <th className="pb-2">Food</th>
                  <th className="w-24 pb-2">kcal</th>
                  <th className="w-24 pb-2">Protein g</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {food.map((f, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <select className="input" value={f.meal ?? ""} onChange={(e) => patchFood(i, { meal: (e.target.value || undefined) as Meal | undefined })} aria-label="Meal">
                        <option value="">–</option>
                        {MEALS.map((m) => (
                          <option key={m} value={m}>
                            {m[0].toUpperCase() + m.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input className="input" placeholder="e.g. 3 eggs + 2 toast" value={f.name} onChange={(e) => patchFood(i, { name: e.target.value })} aria-label="Food" />
                    </td>
                    <td className="py-1 pr-2">
                      <input type="number" inputMode="numeric" min="0" className="input" value={f.kcal ?? ""} onChange={(e) => patchFood(i, { kcal: numOrNull(e.target.value) })} aria-label="Calories" />
                    </td>
                    <td className="py-1 pr-2">
                      <input type="number" inputMode="numeric" min="0" className="input" value={f.proteinG ?? ""} onChange={(e) => patchFood(i, { proteinG: numOrNull(e.target.value) })} aria-label="Protein grams" />
                    </td>
                    <td className="py-1 text-right">
                      <button className="text-ink-400 hover:text-bad" onClick={() => setFood((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove food">
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-700 text-xs text-ink-400">
                  <td className="pt-2" colSpan={2}>
                    Total eaten{eaten.carbsG || eaten.fatG ? ` · ${eaten.carbsG} g carbs · ${eaten.fatG} g fat` : ""}
                  </td>
                  <td className="pt-2 font-display text-base font-bold text-white">{eaten.kcal}</td>
                  <td className="pt-2 font-display text-base font-bold text-white">{eaten.proteinG}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {food.length === 0 && <p className="text-xs text-ink-400">Log meals here, or let an AI estimate calories with “Quick add with AI” above.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="steps">
              Steps {steps ? <span className="normal-case text-ink-400">≈ {stepsKcal(steps, kg)} kcal</span> : null}
            </label>
            <input id="steps" type="number" inputMode="numeric" min="0" step="100" className="input" placeholder="e.g. 8000" value={steps ?? ""} onChange={(e) => setSteps(numOrNull(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="water">
              Water (L)
            </label>
            <input id="water" type="number" inputMode="decimal" min="0" step="0.25" className="input" value={waterL ?? ""} onChange={(e) => setWaterL(numOrNull(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="sleep">
              Sleep (h)
            </label>
            <input id="sleep" type="number" inputMode="decimal" min="0" max="24" step="0.5" className="input" value={sleepHours ?? ""} onChange={(e) => setSleepHours(numOrNull(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="h-display text-lg">Session</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="dur">
              Total duration (min)
            </label>
            <input id="dur" type="number" min="0" className="input" placeholder="e.g. 60" value={duration ?? ""} onChange={(e) => setDuration(numOrNull(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="bw">
              Bodyweight (kg)
            </label>
            <input id="bw" type="number" step="0.1" className="input" value={bodyweight ?? ""} onChange={(e) => setBodyweight(numOrNull(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="rpe">
              Effort (RPE) {rpe ?? "–"}/10
            </label>
            <input id="rpe" type="range" min={1} max={10} value={rpe ?? 7} onChange={(e) => setRpe(Number(e.target.value))} className="w-full accent-[var(--color-volt)]" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Notes for Claude
          </label>
          <textarea
            id="notes"
            className="input h-24"
            placeholder="How did it feel? Sleep, energy, food, pain, anything you want your coach to know…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-400">Session and exercise notes go into your weekly check-in and Coach chat, so Claude reads them.</p>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-600 bg-ink-800/95 px-5 py-3 backdrop-blur">
        <p className="text-sm">
          <span className="font-display text-xl font-bold text-white">{doneSets}</span>/{totalSets} sets ·{" "}
          <span className="font-display text-xl font-bold text-white">{Math.round(volume).toLocaleString()}</span> kg ·{" "}
          <span className="font-display text-xl font-bold text-white">{kcal ?? "–"}</span> kcal
          <span className="ml-1 text-xs text-ink-400">{existing?.kcalClaude ? "(Claude)" : "(est.)"}</span>
          {eaten.kcal > 0 && (
            <>
              {" "}
              · <span className="font-display text-xl font-bold text-white">{eaten.kcal}</span> eaten
            </>
          )}
          {savedAt && <span className="ml-3 text-good">Saved {savedAt}</span>}
        </p>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={resetDay} title="Clear this day and start again from your plan">
            Reset day
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving && <Spinner />} {existing ? "Update session" : "Save session"}
          </button>
        </div>
      </div>
    </div>
  );
}
