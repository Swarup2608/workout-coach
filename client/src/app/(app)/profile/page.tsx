"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Constraint, Profile, Units } from "@/lib/domain";
import { fromDisplay, setUnitsLocally, toDisplay } from "@/lib/units";
import { api } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { AccountSettings } from "@/components/AccountSettings";

const csv = (xs: string[]) => xs.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const numOrNull = (v: string) => (v === "" ? null : Number(v));

export default function ProfilePage() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.profile().then(setP).catch((e) => setError(e.message));
  }, []);

  if (!p) return <div className="card">{error ? <ErrorNote error={error} /> : "Loading…"}</div>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => {
    setSaved(false);
    setP({ ...p, [k]: v });
  };
  const setC = (i: number, c: Partial<Constraint>) => set("constraints", p.constraints.map((x, j) => (j === i ? { ...x, ...c } : x)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await api.saveProfile(p);
      setP(next);
      setUnitsLocally(next.units ?? "kg");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const units: Units = p.units ?? "kg";
  const setupDone = !p.onboarding || !!p.onboarding.completedAt;
  const openSetup = async () => {
    setRestarting(true);
    setError(null);
    try {
      await api.onboarding({ restart: true });
      router.push("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open setup");
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400">Used by every score and chat reply</p>
        <h1 className="h-display text-4xl">Profile & constraints</h1>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold">{setupDone ? "Setup" : "Finish setup"}</h2>
          <p className="text-sm text-ink-400">
            {setupDone ? "Answer the setup questions again to get a fresh starter plan. Your current plan stays in history." : "A few questions left before we build a plan around you."}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={openSetup} disabled={restarting}>
          {restarting && <Spinner />} {setupDone ? "Redo setup" : "Finish setup"}
        </button>
      </div>

      <div className="card grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" value={p.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="exp">Experience</label>
          <select id="exp" className="input" value={p.experience} onChange={(e) => set("experience", e.target.value)}>
            {["Beginner", "Intermediate", "Advanced"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="goal">Goal</label>
          <textarea id="goal" className="input h-20" value={p.goal} onChange={(e) => set("goal", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="proj">Claude Workout Project link</label>
          <input
            id="proj"
            className="input"
            placeholder="https://claude.ai/project/…"
            value={p.claudeProjectUrl ?? ""}
            onChange={(e) => set("claudeProjectUrl", e.target.value.trim())}
          />
          <p className="mt-1 text-xs text-ink-400">Open your project on claude.ai and copy the address bar. “Copy check-in & open Claude” opens this page.</p>
        </div>
        <fieldset className="md:col-span-2">
          <legend className="label">Weight unit</legend>
          <div className="flex gap-2">
            {(["kg", "lb"] as Units[]).map((u) => (
              <button
                key={u}
                type="button"
                aria-pressed={units === u}
                onClick={() => set("units", u)}
                className={`rounded-full border px-4 py-1.5 text-sm ${units === u ? "border-volt-bright bg-volt-bright/10 text-fg" : "border-ink-700 hover:border-volt-bright/50"}`}
              >
                {u}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-400">Changes how weights are shown and entered everywhere. Save to apply.</p>
        </fieldset>
        <div>
          <label className="label" htmlFor="sbw">Start bodyweight ({units})</label>
          <input
            key={`sbw-${units}`}
            id="sbw"
            type="number"
            step="0.1"
            className="input"
            defaultValue={toDisplay(p.startBodyweightKg, units) ?? ""}
            onChange={(e) => set("startBodyweightKg", fromDisplay(numOrNull(e.target.value), units))}
          />
        </div>
        <div>
          <label className="label" htmlFor="tbw">Target bodyweight ({units})</label>
          <input
            key={`tbw-${units}`}
            id="tbw"
            type="number"
            step="0.1"
            className="input"
            defaultValue={toDisplay(p.targetBodyweightKg, units) ?? ""}
            onChange={(e) => set("targetBodyweightKg", fromDisplay(numOrNull(e.target.value), units))}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="h-display text-2xl">Constraints</h2>
          <button
            className="btn btn-ghost"
            onClick={() => set("constraints", [...p.constraints, { id: crypto.randomUUID(), label: "New constraint", reason: "", keywords: [], swaps: [] }])}
          >
            + Add constraint
          </button>
        </div>
        {p.constraints.map((c, i) => (
          <div key={c.id} className="card grid gap-3 md:grid-cols-2">
            <div>
              <label className="label">Rule</label>
              <input className="input" value={c.label} onChange={(e) => setC(i, { label: e.target.value })} />
            </div>
            <div>
              <label className="label">Why</label>
              <input className="input" value={c.reason} onChange={(e) => setC(i, { reason: e.target.value })} />
            </div>
            <div>
              <label className="label">Flag exercises containing (comma separated)</label>
              <input className="input" defaultValue={csv(c.keywords)} onBlur={(e) => setC(i, { keywords: fromCsv(e.target.value) })} />
            </div>
            <div>
              <label className="label">Suggested swaps (comma separated)</label>
              <input className="input" defaultValue={csv(c.swaps)} onBlur={(e) => setC(i, { swaps: fromCsv(e.target.value) })} />
            </div>
            <button className="justify-self-start text-xs text-ink-400 hover:text-bad" onClick={() => set("constraints", p.constraints.filter((_, j) => j !== i))}>
              Remove constraint
            </button>
          </div>
        ))}
      </div>

      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving && <Spinner />} Save profile
        </button>
        {saved && <span className="text-sm text-good">Saved</span>}
      </div>

      <AiProviderSettings />
      <AccountSettings />
    </div>
  );
}
