"use client";

import Link from "next/link";
import type { PlannedExercise, WorkoutPlan } from "@/lib/domain";

const rx = (e: PlannedExercise) => `${e.sets} × ${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`}${e.unit === "seconds" ? " s" : ""}`;

/** "Here's your week": the starter plan onboarding just built. */
export function PlanReveal({ plan }: { plan: WorkoutPlan }) {
  const training = plan.days.filter((d) => !d.isRest).length;
  return (
    <div className="mt-6 space-y-5">
      <div className="card">
        <p className="text-sm text-volt-bright">Setup complete</p>
        <h1 className="h-display mt-1 text-3xl">Here&apos;s your week</h1>
        <p className="mt-1 text-sm text-ink-400">
          {plan.name} · {training} training days. It&apos;s now your active plan; edit any day from the Plan page.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {plan.days.map((d) => (
          <li key={d.day} className={`card ${d.isRest ? "opacity-70" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">{d.day}</h2>
              <span className="text-xs text-ink-400">{d.isRest ? "Rest" : d.title}</span>
            </div>
            {d.isRest ? (
              <p className="mt-2 text-sm text-ink-400">Rest or an easy walk.</p>
            ) : (
              <>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.exercises.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span>{e.name}</span>
                      <span className="shrink-0 tabular-nums text-ink-400">{rx(e)}</span>
                    </li>
                  ))}
                </ul>
                {d.notes.length > 0 && <p className="mt-2 text-xs text-ink-400">{d.notes.join(" ")}</p>}
              </>
            )}
          </li>
        ))}
      </ul>
      <Link href="/dashboard" className="btn btn-primary w-full">
        Start using StarkFitIQ
      </Link>
    </div>
  );
}
