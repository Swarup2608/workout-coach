"use client";

import { useEffect, useState } from "react";
import type { Constraint, Profile } from "@workout/shared";
import { api } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";

const csv = (xs: string[]) => xs.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const numOrNull = (v: string) => (v === "" ? null : Number(v));

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
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
      setP(await api.saveProfile(p));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-400">Used by every score and chat reply</p>
        <h1 className="h-display text-4xl">Profile & constraints</h1>
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
        <div>
          <label className="label" htmlFor="sbw">Start bodyweight (kg)</label>
          <input id="sbw" type="number" step="0.1" className="input" value={p.startBodyweightKg ?? ""} onChange={(e) => set("startBodyweightKg", numOrNull(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="tbw">Target bodyweight (kg)</label>
          <input id="tbw" type="number" step="0.1" className="input" value={p.targetBodyweightKg ?? ""} onChange={(e) => set("targetBodyweightKg", numOrNull(e.target.value))} />
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
    </div>
  );
}
