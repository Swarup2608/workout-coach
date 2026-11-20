"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ExerciseInfo, Profile } from "@/lib/domain";
import { api } from "@/lib/api";
import { ErrorNote } from "@/components/ui";
import { useCoachContext } from "@/components/coach/CoachProvider";

const PATTERNS: Record<string, string> = {
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  horizontal_push: "Push (chest)",
  vertical_push: "Push (overhead)",
  horizontal_pull: "Row",
  vertical_pull: "Pull-down / pull-up",
  biceps: "Biceps",
  triceps: "Triceps",
  shoulders_iso: "Shoulders",
  calves: "Calves",
  core: "Core",
  other: "Your exercises",
};
const SETUPS: Record<string, string> = { gym: "Gym", home_dumbbells: "Home dumbbells", bodyweight: "Bodyweight" };

export default function ExerciseLibraryPage() {
  useCoachContext("Exercise library");
  const [all, setAll] = useState<ExerciseInfo[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [pattern, setPattern] = useState("");
  const [equipment, setEquipment] = useState<string | null>(null);
  const [safe, setSafe] = useState<boolean | null>(null);

  useEffect(() => {
    api.exercises().then(setAll).catch((e) => setError(e.message));
    api.profile().then(setProfile).catch(() => {});
  }, []);

  const injuries = profile?.injuries ?? [];
  // Defaults follow the profile until the user changes the filter.
  const eq = equipment ?? profile?.equipmentSetup ?? "";
  const safeOn = safe ?? injuries.length > 0;

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (all ?? []).filter(
      (e) =>
        (!n || e.name.toLowerCase().includes(n)) &&
        (!muscle || e.muscle === muscle) &&
        (!pattern || e.pattern === pattern) &&
        (!eq || !e.builtIn || e.equipment.includes(eq as never)) &&
        (!safeOn || !e.stresses.some((s) => injuries.includes(s))),
    );
  }, [all, q, muscle, pattern, eq, safeOn, injuries]);

  const muscles = useMemo(() => [...new Set((all ?? []).map((e) => e.muscle))].sort(), [all]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400">{all ? `${list.length} of ${all.length} exercises` : "Loading…"}</p>
        <h1 className="t-workout text-fg text-4xl">Exercises</h1>
      </div>

      <div className="card grid gap-3 md:grid-cols-5">
        <input className="input md:col-span-2" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        <select className="input" value={muscle} onChange={(e) => setMuscle(e.target.value)} aria-label="Muscle">
          <option value="">All muscles</option>
          {muscles.map((m) => (
            <option key={m} value={m} className="capitalize">{m}</option>
          ))}
        </select>
        <select className="input" value={pattern} onChange={(e) => setPattern(e.target.value)} aria-label="Movement">
          <option value="">All movements</option>
          {Object.entries(PATTERNS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className="input" value={eq} onChange={(e) => setEquipment(e.target.value)} aria-label="Equipment">
          <option value="">Any equipment</option>
          {Object.entries(SETUPS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {injuries.length > 0 && (
          <label className="flex items-center gap-2 text-sm md:col-span-5">
            <input type="checkbox" checked={safeOn} onChange={(e) => setSafe(e.target.checked)} />
            Safe for my injuries ({injuries.map((i) => i.replace("_", " ")).join(", ")})
          </label>
        )}
      </div>

      <ErrorNote error={error} />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <li key={e.slug}>
            <Link href={`/exercises/${e.slug}`} className="card flex h-full gap-3 p-3 transition hover:border-volt">
              <Image src={e.image} alt="" width={96} height={96} className="h-24 w-24 shrink-0 rounded-lg object-cover" style={{ filter: "var(--photo-filter)" }} />
              <div className="min-w-0">
                <p className="font-bold text-fg">{e.name}</p>
                <p className="mt-0.5 text-xs capitalize text-ink-400">
                  {e.muscle}
                  {e.level ? ` · ${e.level}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.inPlan && <span className="rounded-full bg-volt/15 px-2 py-0.5 text-[11px] text-volt-bright">In your plan</span>}
                  {!e.builtIn && <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-400">Yours</span>}
                  {e.lastDone && <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-400">Last {e.lastDone}</span>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {all && !list.length && <p className="card text-center text-ink-400">No exercises match. Try clearing a filter.</p>}
    </div>
  );
}
