import { STEPS, TOTAL_STEPS } from "./steps";

export type StepStatus = "done" | "current" | "skipped" | "todo";

/** Status of every step: 1–2 are always done; red marks an optional step the user skipped. */
export function stepStatuses(current: number | null, reached: number, skipped: number[] = []): StepStatus[] {
  return STEPS.map((s) => {
    if (s.n === current) return "current";
    if (skipped.includes(s.n)) return "skipped";
    if (s.prefilled || s.n <= reached) return "done";
    return "todo";
  });
}

const SEGMENT: Record<StepStatus, string> = {
  done: "bg-good",
  skipped: "bg-bad",
  current: "bg-good/40",
  todo: "bg-ink-700",
};

/** "✓ 2 of 8 steps completed" + one bar segment per step (green done, red skipped, grey to do). */
export function SegmentedProgress({ statuses, className = "" }: { statuses: StepStatus[]; className?: string }) {
  const done = statuses.filter((s) => s === "done").length;
  const skipped = statuses.filter((s) => s === "skipped").length;
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <span className="grid h-4 w-4 place-items-center rounded-full bg-good text-[10px] font-bold text-white" aria-hidden>
          ✓
        </span>
        <span>
          <span className="font-semibold text-good">{done}</span> of {TOTAL_STEPS} steps completed
          {skipped > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-bad">{skipped}</span> skipped
            </>
          )}
        </span>
      </p>
      <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_STEPS} aria-valuenow={done} aria-label={`${done} of ${TOTAL_STEPS} steps completed`}>
        {statuses.map((s, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${SEGMENT[s]} ${s === "current" ? "animate-pulse" : ""}`} />
        ))}
      </div>
    </div>
  );
}
