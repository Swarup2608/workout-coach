"use client";

import Link from "next/link";
import { useState } from "react";
import type { Profile } from "@/lib/domain";
import { api } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";
import { TOTAL_STEPS } from "@/components/onboarding/steps";
import { SegmentedProgress, stepStatuses } from "@/components/onboarding/SegmentedProgress";

/** Dashboard welcome for users who haven't finished (or skipped) onboarding. */
export function SetupCard({ profile, name, onSkipped }: { profile: Profile; name: string; onSkipped: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const step = profile.onboarding?.step ?? 2;
  const first = name.trim().split(/\s+/)[0] || "there";

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      onSkipped((await api.onboarding({ skip: true })).profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not skip");
      setBusy(false);
    }
  };

  return (
    <section className="card border-volt-bright/40 bg-volt-bright/5" aria-labelledby="setup-title">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="setup-title" className="h-display text-2xl">
            Welcome, {first}
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            You&apos;re {step} of {TOTAL_STEPS} steps in. Finish setup to get a plan built around you.
          </p>
          <SegmentedProgress statuses={stepStatuses(null, step)} className="mt-3 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={skip} disabled={busy}>
            {busy && <Spinner />} Skip for now
          </button>
          <Link href="/onboarding" className="btn btn-primary">
            Continue setup
          </Link>
        </div>
      </div>
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </section>
  );
}
