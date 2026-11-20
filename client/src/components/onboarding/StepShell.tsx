"use client";

import { ErrorNote, Spinner } from "@/components/ui";
import { STEPS } from "./steps";
import { SegmentedProgress, stepStatuses } from "./SegmentedProgress";

/**
 * Progress header: a segmented green/red bar plus a clickable stepper.
 * Green check = done (1–2 always, from signup), red = optional step skipped, ring = current, grey = to do.
 */
export function Progress({ current, reached, skipped = [], onJump }: { current: number; reached: number; skipped?: number[]; onJump: (n: number) => void }) {
  const statuses = stepStatuses(current, reached, skipped);
  return (
    <div>
      <SegmentedProgress statuses={statuses} />
      <ol className="mt-5 flex items-start">
        {STEPS.map((s, i) => {
          const st = statuses[i];
          const canJump = s.prefilled || s.n <= Math.max(reached + 1, 3);
          const circle =
            st === "done"
              ? "border-good bg-good text-white"
              : st === "skipped"
                ? "border-bad bg-bad text-white"
                : st === "current"
                  ? "border-good bg-good/15 text-good ring-4 ring-good/20"
                  : "border-ink-600 bg-ink-900 text-ink-400";
          const nextSt = statuses[i + 1];
          return (
            <li key={s.n} className="flex flex-1 items-start last:flex-none">
              <button
                type="button"
                disabled={!canJump || st === "current"}
                onClick={() => onJump(s.n)}
                aria-current={st === "current" ? "step" : undefined}
                aria-label={`Step ${s.n}: ${s.title}${st === "done" ? " (done)" : st === "skipped" ? " (skipped)" : ""}`}
                className="group flex w-9 flex-col items-center gap-1.5 disabled:cursor-default"
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold transition ${circle} ${canJump && st !== "current" ? "group-hover:scale-110" : ""}`}>
                  {st === "done" ? "✓" : st === "skipped" ? "✕" : s.n}
                </span>
                <span
                  className={`hidden w-20 text-center text-[11px] leading-tight sm:block ${
                    st === "current" ? "font-semibold text-fg" : st === "done" ? "text-good" : st === "skipped" ? "text-bad" : "text-ink-400"
                  }`}
                >
                  {s.title}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`mt-4 h-0.5 flex-1 rounded-full ${st === "done" || st === "skipped" ? (nextSt === "todo" ? "bg-gradient-to-r from-good to-ink-700" : "bg-good") : "border-t-2 border-dotted border-ink-600 bg-transparent"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-ink-400 sm:hidden">
        Step {current}: <span className="font-semibold text-fg">{STEPS[current - 1].title}</span>
      </p>
    </div>
  );
}

export function StepShell({
  title,
  subtitle,
  children,
  error,
  busy,
  canContinue = true,
  continueLabel = "Continue",
  onBack,
  onContinue,
  onSkipStep,
  skipLabel = "Skip",
  onSkipSetup,
  redo = false,
  asForm = true,
}: {
  /** Redoing a finished setup: "skip" becomes "cancel redo" (old answers are kept). */
  redo?: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  error: string | null;
  busy: boolean;
  canContinue?: boolean;
  continueLabel?: string;
  onBack?: () => void;
  onContinue: () => void;
  onSkipStep?: () => void;
  skipLabel?: string;
  onSkipSetup: () => void;
  /** false when the step embeds its own inputs and buttons (e.g. AI settings), so Enter there doesn't finish the step */
  asForm?: boolean;
}) {
  const Wrap = asForm ? "form" : "div";
  return (
    <Wrap
      className="card mt-6 space-y-5"
      {...(asForm
        ? {
            onSubmit: (e: React.FormEvent) => {
              e.preventDefault();
              if (canContinue && !busy) onContinue();
            },
            noValidate: true,
          }
        : {})}
    >
      <div>
        <h1 className="t-workout text-fg text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {children}
      <ErrorNote error={error} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {onBack && (
          <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>
            Back
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {onSkipStep && (
            <button type="button" className="btn btn-ghost" onClick={onSkipStep} disabled={busy}>
              {skipLabel}
            </button>
          )}
          <button type={asForm ? "submit" : "button"} onClick={asForm ? undefined : onContinue} className="btn btn-primary" disabled={!canContinue || busy}>
            {busy && <Spinner />} {continueLabel}
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-ink-400">
        <button type="button" className="text-volt-bright underline underline-offset-2 hover:text-fg" onClick={onSkipSetup} disabled={busy}>
          {redo ? "Cancel redo" : "Skip setup for now"}
        </button>{" "}
        {redo ? "· your current setup and plan stay exactly as they are." : "· you keep the starter plan and can finish from your profile."}
      </p>
    </Wrap>
  );
}

/** A selectable option tile (single or multi select). */
export function Option({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        selected ? "border-volt-bright bg-volt-bright/10 text-fg" : "border-ink-700 hover:border-volt-bright/50"
      }`}
    >
      <span className="block font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink-400">{hint}</span>}
    </button>
  );
}

/** A compact pill for small choices (days, minutes, chips). */
export function Pill({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`min-w-12 rounded-full border px-4 py-2 text-sm transition ${
        selected ? "border-volt-bright bg-volt-bright/10 text-fg" : "border-ink-700 hover:border-volt-bright/50"
      }`}
    >
      {children}
    </button>
  );
}
