"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_REST,
  EFFORTS,
  WEEKDAYS,
  exerciseSlug,
  nextTimeHint,
  guessEquipment,
  unitShort,
  weekdayOf,
  workoutTitle,
  type ExerciseInfo,
  type LoggedSet,
  type PlannedExercise,
  type Profile,
  type Weekday,
  type WorkoutPlan,
  type WorkoutSession,
} from "@/lib/domain";
import { api, today, type SessionInput } from "@/lib/api";
import { fromDisplay, toDisplay, useUnits } from "@/lib/units";
import { ErrorNote, Spinner } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icons";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { DATA_CHANGED } from "@/components/coach/actions";
import { fmtClock, useElapsed, useNow } from "@/components/workout/clock";
import { askNotificationPermission, beep, notify, unlockAudio, vibrate } from "@/components/workout/alerts";

type Prev = Awaited<ReturnType<typeof api.previous>>;
type Ex = SessionInput["exercises"][number];

const numOrNull = (v: string) => (v === "" ? null : Number(v));
const toInput = (s: WorkoutSession): Ex[] =>
  s.exercises.map((e) => ({
    plannedId: e.plannedId,
    name: e.name,
    unit: e.unit,
    equipment: e.equipment ?? guessEquipment(e.name),
    perSide: !!e.perSide,
    notes: e.notes ?? "",
    sets: e.sets,
  }));

export default function LiveWorkoutPage() {
  return (
    <Suspense fallback={<div className="card">Loading…</div>}>
      <LiveWorkout />
    </Suspense>
  );
}

function LiveWorkout() {
  const router = useRouter();
  const params = useSearchParams();
  const { units } = useUnits();
  const { confirm, dialog } = useConfirm();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<Ex[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [stale, setStale] = useState<{ lastActivityAt: string } | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prev, setPrev] = useState<Prev>({});
  const [library, setLibrary] = useState<ExerciseInfo[]>([]);
  const [idx, setIdx] = useState(0);
  const [sheet, setSheet] = useState<null | "add" | "swap">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");

  const current = exercises[idx];
  const workoutName = session ? (workoutTitle(session, plan) ?? "Workout") : undefined;
  useCoachContext("Live workout", current ? `${workoutName}, now on ${current.name}` : workoutName);

  const load = useCallback(async () => {
    try {
      const [live, p, prof] = await Promise.all([api.liveSession(), api.activePlan(), api.profile()]);
      setPlan(p);
      setProfile(prof);
      if (live.session) {
        setSession(live.session);
        setExercises(toInput(live.session));
        setStale(live.stale && live.lastActivityAt ? { lastActivityAt: live.lastActivityAt } : null);
        setPrev(await api.previous(live.session.date));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your workout");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    api.exercises().then(setLibrary).catch(() => {});
  }, [load]);

  // A coach action (swap, extra set…) changed the session: reload it.
  useEffect(() => {
    const reload = () => load();
    window.addEventListener(DATA_CHANGED, reload);
    return () => window.removeEventListener(DATA_CHANGED, reload);
  }, [load]);

  // ── Start ──
  const start = useCallback(
    async (planDay: Weekday | "custom", title?: string) => {
      unlockAudio();
      void askNotificationPermission();
      setBusy(true);
      setError(null);
      try {
        const r = await api.startWorkout(today(), planDay, title);
        setSession(r.session);
        setExercises(toInput(r.session));
        setIdx(0);
        setPrev(await api.previous(r.session.date));
        router.replace("/workout/live");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  // ?day=Monday or ?day=custom starts straight away (from Today, Plan or a coach action).
  const autoStarted = useRef(false);
  useEffect(() => {
    const day = params.get("day");
    if (!loaded || session || autoStarted.current || day === null) return;
    autoStarted.current = true;
    if (day === "custom") start("custom");
    else if ((WEEKDAYS as string[]).includes(day)) start(day as Weekday);
    else if (plan) start(weekdayOf(today()));
  }, [loaded, session, params, plan, start]);

  // ── Autosave: shortly after each change, plus a safety save every 15 s ──
  const latest = useRef({ exercises, session });
  latest.current = { exercises, session };
  const dirty = useRef(false);
  const save = useCallback(async (extra: { restEndsAt?: string | null } = {}) => {
    const { exercises: ex, session: s } = latest.current;
    if (!s) return;
    dirty.current = false;
    setSaveState("saving");
    try {
      const saved = await api.patchSession(s.id, { exercises: ex, ...extra });
      setSession((cur) => (cur ? { ...cur, restEndsAt: saved.restEndsAt, updatedAt: saved.updatedAt } : cur));
      setSaveState(dirty.current ? "dirty" : "saved");
    } catch {
      dirty.current = true;
      setSaveState("dirty");
    }
  }, []);
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => save(), 800);
    return () => clearTimeout(t);
  }, [exercises, save]);
  useEffect(() => {
    const t = setInterval(() => dirty.current && save(), 15000);
    const flush = () => document.visibilityState === "hidden" && dirty.current && save();
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [save]);

  const edit = (fn: (ex: Ex[]) => Ex[]) => {
    dirty.current = true;
    setSaveState("dirty");
    setExercises((ex) => fn(structuredClone(ex)));
  };

  // ── Keep the screen awake ──
  useEffect(() => {
    if (!session || profile?.keepAwake === false || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // denied or unsupported
      }
    };
    get();
    const again = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", again);
    return () => {
      document.removeEventListener("visibilitychange", again);
      void lock?.release().catch(() => {});
    };
  }, [session, profile?.keepAwake]);

  // ── Rest timer ──
  const restFor = useCallback(
    (name: string) => {
      const o = profile?.restOverrides?.[name.toLowerCase()];
      if (o) return o;
      const d = profile?.restDefaults ?? DEFAULT_REST;
      const info = library.find((x) => x.slug === exerciseSlug(name));
      const compound = info ? info.restSec >= 90 : /squat|deadlift|press|row|pull-?up|chin-?up|lunge|dip/i.test(name);
      return compound ? d.compound : d.isolation;
    },
    [profile, library],
  );

  const setRest = (endsAt: string | null) => {
    setSession((s) => (s ? { ...s, restEndsAt: endsAt } : s));
    save({ restEndsAt: endsAt });
  };

  const restEndsAt = session?.restEndsAt ? Date.parse(session.restEndsAt) : null;
  useEffect(() => {
    if (!restEndsAt) return;
    const wait = restEndsAt - Date.now();
    if (wait < -2000) return;
    const t = setTimeout(() => {
      if (profile?.timerSound !== false) beep();
      if (profile?.timerVibrate !== false) vibrate();
      const next = latest.current.exercises.find((e) => e.sets.some((s) => !s.done));
      notify("Rest over", next ? `Next set: ${next.name}` : "Time for your next set");
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [restEndsAt, profile?.timerSound, profile?.timerVibrate]);

  // ── Sets ──
  const planned = (e: Ex): PlannedExercise | undefined => plan?.days.flatMap((d) => d.exercises).find((p) => p.id === e.plannedId);
  const prevSets = (e: Ex) => prev[e.name.toLowerCase()]?.sets ?? [];

  const tick = (ei: number, si: number) => {
    unlockAudio();
    const e = exercises[ei];
    const s = e.sets[si];
    const nowDone = !s.done;
    edit((ex) => {
      const set = ex[ei].sets[si];
      if (nowDone) {
        const p = prevSets(e)[si] ?? prevSets(e).at(-1);
        if (set.reps == null) set.reps = p?.reps ?? planned(e)?.repMax ?? null;
        if (set.weightKg == null && p?.weightKg != null) set.weightKg = p.weightKg;
      }
      set.done = nowDone;
      set.completedAt = nowDone ? new Date().toISOString() : null;
      return ex;
    });
    if (nowDone && !session?.pausedAt) {
      const moreLeft = e.sets.some((x, j) => j !== si && !x.done) || exercises.some((x, j) => j !== ei && x.sets.some((y) => !y.done));
      if (moreLeft) setRest(new Date(Date.now() + restFor(e.name) * 1000).toISOString());
      // Last set of this exercise: move on to the next unfinished one.
      if (!e.sets.some((x, j) => j !== si && !x.done)) {
        const next = exercises.findIndex((x, j) => j > ei && x.sets.some((y) => !y.done));
        if (next >= 0) setTimeout(() => setIdx(next), 400);
      }
    } else if (!nowDone) setRest(null);
  };

  const patchSet = (ei: number, si: number, p: Partial<LoggedSet>) =>
    edit((ex) => {
      Object.assign(ex[ei].sets[si], p);
      return ex;
    });

  const addSet = (ei: number) =>
    edit((ex) => {
      const last = ex[ei].sets.at(-1);
      ex[ei].sets.push({ weightKg: last?.weightKg ?? null, reps: null, negatives: null, done: false, completedAt: null });
      return ex;
    });

  const removeSet = (ei: number) =>
    edit((ex) => {
      const i = ex[ei].sets.map((s) => s.done).lastIndexOf(false);
      if (i >= 0) ex[ei].sets.splice(i, 1);
      return ex;
    });

  const addExercise = (info: Pick<ExerciseInfo, "name" | "unit">) => {
    edit((ex) => [
      ...ex,
      { plannedId: null, name: info.name, unit: info.unit, equipment: guessEquipment(info.name), perSide: false, notes: "", sets: Array.from({ length: 3 }, () => ({ weightKg: null, reps: null, negatives: null, done: false, completedAt: null })) },
    ]);
    setIdx(exercises.length);
    setSheet(null);
  };

  const swapTo = (info: Pick<ExerciseInfo, "name" | "unit">) => {
    edit((ex) => {
      Object.assign(ex[idx], { name: info.name, unit: info.unit, equipment: guessEquipment(info.name) });
      return ex;
    });
    setSheet(null);
  };

  const removeExercise = async () => {
    if (!current) return;
    if (!(await confirm({ title: `Remove ${current.name}?`, body: "It's removed from this workout only. Your plan stays the same.", confirmLabel: "Remove", tone: "danger" }))) return;
    edit((ex) => ex.filter((_, i) => i !== idx));
    setIdx((i) => Math.max(0, i - 1));
  };

  // ── Pause / finish / discard ──
  const pauseResume = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const s = session.pausedAt ? await api.resumeWorkout(session.id) : await api.pauseWorkout(session.id);
      setSession((cur) => (cur ? { ...cur, pausedAt: s.pausedAt, pausedMs: s.pausedMs, restEndsAt: s.restEndsAt } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the timer");
    } finally {
      setBusy(false);
    }
  };

  const finish = async (endedAt?: string) => {
    if (!session) return;
    const undone = exercises.flatMap((e) => e.sets.filter((s) => !s.done).map(() => e.name));
    const doneCount = exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    const total = doneCount + undone.length;
    if (!endedAt && (undone.length || !doneCount)) {
      const byEx = [...new Set(undone)].map((n) => `${n} (${undone.filter((x) => x === n).length})`);
      const ok = await confirm({
        title: doneCount ? `${undone.length} of ${total} sets not done. Finish anyway?` : "No sets logged. Finish anyway?",
        body: doneCount ? (
          <div className="space-y-2 text-sm">
            <p>Unfinished sets are saved as not done, so your weekly score stays honest.</p>
            <p className="text-ink-400">Not done: {byEx.join(", ")}</p>
          </div>
        ) : (
          "The time is saved as a workout with no sets, which is fine for a class or a run. You can add sets later on the Log page."
        ),
        confirmLabel: "Finish anyway",
        cancelLabel: "Keep going",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.patchSession(session.id, { exercises });
      const s = await api.finishWorkout(session.id, endedAt);
      router.push(`/workout/summary/${s.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish");
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!session) return;
    if (!(await confirm({ title: "Discard this workout?", body: "The timer and every set you logged in it are deleted.", confirmLabel: "Discard", tone: "danger" }))) return;
    await api.discardWorkout(session.id).catch(() => {});
    router.push("/dashboard");
  };

  if (!loaded) return <div className="card">Loading…</div>;

  if (!session) return <StartScreen plan={plan} busy={busy} error={error} onStart={start} />;

  return (
    <div className="space-y-4 pb-24">
      {dialog}
      {stale && (
        <div className="card border-warn/50" role="alert">
          <p className="font-medium text-fg">This workout has been open for over 4 hours.</p>
          <p className="mt-1 text-sm text-ink-400">Did you forget to finish? We can end it at your last logged set ({new Date(stale.lastActivityAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}).</p>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={() => finish(stale.lastActivityAt)} disabled={busy}>
              Finish at last set
            </button>
            <button className="btn btn-ghost" onClick={() => setStale(null)}>
              Keep going
            </button>
          </div>
        </div>
      )}

      <Header title={workoutName ?? "Workout"} session={session} saveState={saveState} busy={busy} onPause={pauseResume} onFinish={() => finish()} onDiscard={discard} />
      <ErrorNote error={error} />

      {/* Exercise strip */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Exercises">
        {exercises.map((e, i) => {
          const done = e.sets.length > 0 && e.sets.every((s) => s.done);
          return (
            <button
              key={i}
              role="tab"
              aria-selected={i === idx}
              onClick={() => setIdx(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${i === idx ? "border-volt bg-volt/15 text-fg" : done ? "border-good/50 text-good" : "border-ink-700 text-ink-400"}`}
            >
              {done ? "✓ " : ""}
              {e.name}
            </button>
          );
        })}
        <button className="shrink-0 rounded-full border border-dashed border-ink-600 px-3 py-1.5 text-xs text-ink-400 hover:border-volt" onClick={() => setSheet("add")}>
          + Add exercise
        </button>
      </div>

      {current ? (
        <ExerciseCard
          ex={current}
          planned={planned(current)}
          prevSets={prevSets(current)}
          units={units}
          restSec={restFor(current.name)}
          library={library}
          onTick={(si) => tick(idx, si)}
          onPatch={(si, p) => patchSet(idx, si, p)}
          onAddSet={() => addSet(idx)}
          onRemoveSet={() => removeSet(idx)}
          onNotes={(n) =>
            edit((ex) => {
              ex[idx].notes = n;
              return ex;
            })
          }
          onSwap={() => setSheet("swap")}
          onRemove={removeExercise}
          onPrev={idx > 0 ? () => setIdx(idx - 1) : undefined}
          onNext={idx < exercises.length - 1 ? () => setIdx(idx + 1) : undefined}
        />
      ) : (
        <div className="card text-center">
          <p className="text-ink-400">No exercises yet. The timer is running, so you can just time a class or a run, or add exercises as you go.</p>
          <button className="btn btn-primary mt-4" onClick={() => setSheet("add")}>
            + Add exercise
          </button>
        </div>
      )}

      {restEndsAt && !session.pausedAt && <RestBar endsAt={restEndsAt} onChange={(ms) => setRest(ms ? new Date(ms).toISOString() : null)} />}

      {sheet && (
        <ExerciseSheet
          title={sheet === "add" ? "Add an exercise" : `Swap ${current?.name}`}
          library={library}
          current={sheet === "swap" ? current?.name : undefined}
          onPick={sheet === "add" ? addExercise : swapTo}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function StartScreen({ plan, busy, error, onStart }: { plan: WorkoutPlan | null; busy: boolean; error: string | null; onStart: (d: Weekday | "custom", title?: string) => void }) {
  const todayDay = weekdayOf(today());
  const [day, setDay] = useState<Weekday>(todayDay);
  const [title, setTitle] = useState("");
  const pd = plan?.days.find((d) => d.day === day);
  useCoachContext("Live workout", "choosing a workout");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm text-ink-400">The timer starts when you tap Start</p>
        <h1 className="t-workout text-fg text-4xl">Start a workout</h1>
      </div>
      {plan && (
        <div className="card space-y-3">
          <label className="label" htmlFor="day">From your plan</label>
          <select id="day" className="input" value={day} onChange={(e) => setDay(e.target.value as Weekday)}>
            {plan.days.map((d) => (
              <option key={d.day} value={d.day} disabled={d.isRest}>
                {d.day}{d.day === todayDay ? " (today)" : ""}: {d.isRest ? "Rest" : d.title}
              </option>
            ))}
          </select>
          {pd && !pd.isRest && <p className="text-sm text-ink-400">{pd.exercises.map((e) => e.name).join(" · ")}</p>}
          <button className="btn btn-primary w-full py-3 text-base" disabled={busy || !pd || pd.isRest} onClick={() => onStart(day)}>
            {busy && <Spinner />} Start {pd?.title ?? "workout"}
          </button>
        </div>
      )}
      <div className="card space-y-3">
        <label className="label" htmlFor="title">Empty workout</label>
        <input id="title" className="input" placeholder="Name it (optional), e.g. Yoga class" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <p className="text-xs text-ink-400">Add exercises from the library as you go, or just time a class or a run.</p>
        <button className="btn btn-ghost w-full" disabled={busy} onClick={() => onStart("custom", title.trim() || undefined)}>
          Start empty workout
        </button>
      </div>
      <ErrorNote error={error} />
      {error?.includes("already logged") && (
        <Link href="/log" className="text-sm link">
          Open today in Log →
        </Link>
      )}
    </div>
  );
}

function Header({ title, session, saveState, busy, onPause, onFinish, onDiscard }: { title: string; session: WorkoutSession; saveState: string; busy: boolean; onPause: () => void; onFinish: () => void; onDiscard: () => void }) {
  const elapsed = useElapsed(session);
  const paused = !!session.pausedAt;
  return (
    <div className="sticky top-[57px] z-10 -mx-4 border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-400">
            {title} ·{" "}
            <span aria-live="polite">{saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Unsaved"}</span>
          </p>
          <p className={`font-display text-4xl font-bold tabular-nums ${paused ? "text-warn" : "text-fg"}`} aria-label={`Elapsed ${fmtClock(elapsed)}${paused ? ", paused" : ""}`}>
            {fmtClock(elapsed)}
            {paused && <span className="ml-2 align-middle text-sm font-medium">Paused</span>}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onPause} disabled={busy}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="btn btn-primary" onClick={onFinish} disabled={busy}>
          {busy && <Spinner />} Finish
        </button>
        <button className="btn btn-danger" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  );
}

function ExerciseCard(props: {
  ex: Ex;
  planned?: PlannedExercise;
  prevSets: Prev[string]["sets"];
  units: "kg" | "lb";
  restSec: number;
  library: ExerciseInfo[];
  onTick: (si: number) => void;
  onPatch: (si: number, p: Partial<LoggedSet>) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onNotes: (n: string) => void;
  onSwap: () => void;
  onRemove: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { ex, planned, prevSets, units } = props;
  const showW = (kg: number | null | undefined) => (kg == null ? "" : String(units === "kg" ? kg : toDisplay(kg, units)));
  const readW = (v: string) => (units === "kg" ? numOrNull(v) : fromDisplay(numOrNull(v), units));
  const info = props.library.find((x) => x.slug === exerciseSlug(ex.name));
  const target = planned ? `${planned.sets} × ${planned.repMin}${planned.repMax !== planned.repMin ? `–${planned.repMax}` : ""}${ex.unit === "reps" ? "" : ` ${unitShort(ex.unit)}`}` : null;
  // Last time's effort turns into a nudge for today ("felt easy: add a little weight").
  const lastHint = nextTimeHint(prevSets.map((s) => ({ done: true, rir: s.rir ?? null })), ex.unit);

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="t-workout text-3xl text-fg">{ex.name}</h2>
          <p className="text-sm text-ink-400">
            {target ? `Target ${target}` : "Your own exercise"} · rest {props.restSec}s
            {prevSets.length ? ` · last time ${prevSets.map((s) => `${s.weightKg != null ? `${showW(s.weightKg)}${units}` : "BW"}×${s.reps}`).join(", ")}` : ""}
          </p>
          {lastHint && <p className="text-xs text-volt-bright">Last time: {lastHint.charAt(0).toLowerCase() + lastHint.slice(1)}</p>}
        </div>
        <div className="flex gap-2 text-xs">
          <Link href={`/exercises/${exerciseSlug(ex.name)}`} className="rounded-lg border border-ink-700 px-2 py-1 hover:border-volt" aria-label={`How to do ${ex.name}`}>
            ⓘ How to
          </Link>
          {info && (
            <a href={info.youtubeUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-ink-700 px-2 py-1 hover:border-volt">
              <Icon name="play" size={13} className="mr-1" />Video
            </a>
          )}
          <button className="rounded-lg border border-ink-700 px-2 py-1 hover:border-volt" onClick={props.onSwap}>
            <Icon name="swap" size={14} className="mr-1" />Swap
          </button>
          <button className="rounded-lg border border-ink-700 px-2 py-1 text-ink-400 hover:border-bad hover:text-bad" onClick={props.onRemove} aria-label={`Remove ${ex.name}`}>
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem] gap-2 px-1 text-xs text-ink-400">
          <span>Set</span>
          <span>{ex.equipment === "bodyweight" ? `+${units}` : units}</span>
          <span>{ex.unit === "reps" ? "Reps" : unitShort(ex.unit)}</span>
          <span className="text-center">Done</span>
        </div>
        {ex.sets.map((s, si) => {
          const p = prevSets[si] ?? prevSets.at(-1);
          return (
            <div key={si} className={`rounded-xl ${s.done ? "bg-good/10" : ""}`}>
            <div className="grid grid-cols-[2rem_1fr_1fr_3.5rem] items-center gap-2 px-1 py-1">
              <span className="text-center font-display font-bold text-ink-400">{si + 1}</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                className="input py-2.5 text-center text-lg"
                aria-label={`Set ${si + 1} weight`}
                placeholder={p?.weightKg != null ? showW(p.weightKg) : "BW"}
                value={showW(s.weightKg)}
                onChange={(e) => props.onPatch(si, { weightKg: readW(e.target.value) })}
              />
              <input
                type="number"
                inputMode="numeric"
                min="0"
                className="input py-2.5 text-center text-lg"
                aria-label={`Set ${si + 1} reps`}
                placeholder={p?.reps != null ? String(p.reps) : planned ? String(planned.repMax) : "–"}
                value={s.reps ?? ""}
                onChange={(e) => props.onPatch(si, { reps: numOrNull(e.target.value) })}
              />
              <button
                onClick={() => props.onTick(si)}
                aria-pressed={s.done}
                aria-label={`Set ${si + 1} ${s.done ? "done, tap to undo" : "mark done"}`}
                className={`h-12 rounded-xl border text-xl font-bold transition ${s.done ? "border-good bg-good text-white" : "border-ink-600 hover:border-good"}`}
              >
                ✓
              </button>
            </div>
            {s.done && (
              <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2 pl-11" role="radiogroup" aria-label={`How hard was set ${si + 1}?`}>
                <span className="text-xs text-ink-400">How hard?</span>
                {EFFORTS.map((f) => (
                  <button
                    key={f.rir}
                    role="radio"
                    aria-checked={s.rir === f.rir}
                    title={f.hint}
                    onClick={() => props.onPatch(si, { rir: s.rir === f.rir ? null : f.rir })}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${s.rir === f.rir ? "border-volt bg-volt/15 text-fg" : "border-ink-600 text-ink-400 hover:text-fg"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <button className="btn btn-ghost px-3 py-1 text-xs" onClick={props.onAddSet}>
            + Set
          </button>
          {ex.sets.some((s) => !s.done) && (
            <button className="btn btn-ghost px-3 py-1 text-xs" onClick={props.onRemoveSet}>
              − Set
            </button>
          )}
        </div>
      </div>

      <textarea
        className="input h-16 text-sm"
        placeholder="Note: seat height, form, pain, felt easy…"
        value={ex.notes}
        onChange={(e) => props.onNotes(e.target.value)}
        aria-label={`Notes for ${ex.name}`}
      />

      <div className="flex justify-between">
        <button className="btn btn-ghost" onClick={props.onPrev} disabled={!props.onPrev}>
          ← Previous
        </button>
        <button className="btn btn-ghost" onClick={props.onNext} disabled={!props.onNext}>
          Next →
        </button>
      </div>
    </div>
  );
}

function RestBar({ endsAt, onChange }: { endsAt: number; onChange: (endsAtMs: number | null) => void }) {
  const now = useNow();
  const left = endsAt - now;
  const over = left <= 0;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ink-700 bg-ink-900/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur" role="timer" aria-live="off">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-ink-400">{over ? "Rest over. Next set!" : "Rest"}</p>
          <p className={`font-display text-3xl font-bold tabular-nums ${over ? "text-good" : "text-fg"}`}>{over ? "Go" : fmtClock(left)}</p>
        </div>
        {!over && (
          <>
            <button className="btn btn-ghost px-3" onClick={() => onChange(Math.max(Date.now(), endsAt - 15000))} aria-label="15 seconds less rest">
              −15s
            </button>
            <button className="btn btn-ghost px-3" onClick={() => onChange(endsAt + 15000)} aria-label="15 seconds more rest">
              +15s
            </button>
          </>
        )}
        <button className="btn btn-primary" onClick={() => onChange(null)}>
          {over ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}

function ExerciseSheet({ title, library, current, onPick, onClose }: { title: string; library: ExerciseInfo[]; current?: string; onPick: (e: Pick<ExerciseInfo, "name" | "unit">) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [alts, setAlts] = useState<ExerciseInfo[] | null>(null);
  useEffect(() => {
    if (current) api.exercise(exerciseSlug(current)).then((r) => setAlts(r.alternatives)).catch(() => setAlts([]));
  }, [current]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = n ? library.filter((e) => e.name.toLowerCase().includes(n)) : library.filter((e) => e.inPlan || e.builtIn);
    return list.slice(0, 40);
  }, [q, library]);
  const custom = q.trim() && !library.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <div role="dialog" aria-label={title} className="fixed inset-x-0 bottom-0 top-20 z-50 flex flex-col rounded-t-2xl border border-ink-700 bg-ink-950 md:inset-x-auto md:left-1/2 md:top-24 md:bottom-24 md:w-[480px] md:-translate-x-1/2 md:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-ink-700 p-4">
          <h2 className="flex-1 font-bold text-fg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800">
            ✕
          </button>
        </div>
        <div className="p-4 pb-2">
          <input autoFocus className="input" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
          {current && !q && (
            <>
              <p className="label mt-2">Alternatives that fit your setup</p>
              {alts === null ? <Spinner /> : alts.length ? alts.map((e) => <Row key={e.slug} e={e} onPick={onPick} />) : <p className="text-sm text-ink-400">No close matches. Search below.</p>}
              <p className="label mt-4">All exercises</p>
            </>
          )}
          {custom && (
            <button className="w-full rounded-xl border border-dashed border-ink-600 p-3 text-left text-sm hover:border-volt" onClick={() => onPick({ name: q.trim(), unit: "reps" })}>
              + Use “{q.trim()}”
            </button>
          )}
          {results.map((e) => (
            <Row key={e.slug} e={e} onPick={onPick} />
          ))}
        </div>
      </div>
    </>
  );
}

function Row({ e, onPick }: { e: ExerciseInfo; onPick: (e: Pick<ExerciseInfo, "name" | "unit">) => void }) {
  return (
    <button className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-ink-800" onClick={() => onPick(e)}>
      <span className="text-fg">{e.name}</span>
      <span className="text-xs capitalize text-ink-400">
        {e.muscle}
        {e.inPlan ? " · in plan" : ""}
      </span>
    </button>
  );
}
