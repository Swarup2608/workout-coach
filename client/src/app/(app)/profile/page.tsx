"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_REST, GOAL_LABELS, type Constraint, type Profile, type ProgressData, type Units } from "@/lib/domain";
import { cmToDisplay, displayToCm, fromDisplay, setUnitsLocally, toDisplay } from "@/lib/units";
import { api, today } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useCoachContext } from "@/components/coach/CoachProvider";
import { ErrorNote, Spinner } from "@/components/ui";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { AccountSettings } from "@/components/AccountSettings";
import { Icon } from "@/components/Icons";

const csv = (xs: string[]) => xs.join(", ");
const fromCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const numOrNull = (v: string) => (v === "" ? null : Number(v));

const TABS = [
  { id: "about", label: "About you" },
  { id: "training", label: "Training" },
  { id: "prefs", label: "Workout preferences" },
  { id: "constraints", label: "Constraints" },
  { id: "ai", label: "AI coach" },
  { id: "account", label: "Account & security" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const tabFromHash = (): TabId => {
  const h = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? "about") as TabId;
};

export default function ProfilePage() {
  const router = useRouter();
  const [p, setP] = useState<Profile | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ProgressData["totals"] | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("about");
  useCoachContext("Profile", TABS.find((t) => t.id === tab)?.label);

  // The URL hash picks the tab (/profile#account = Settings, #ai = AI coach).
  useEffect(() => {
    const sync = () => setTab(tabFromHash());
    // A <Link> to /profile#… clicked while already here (top bar, sidebar, avatar menu) updates the URL
    // too late and fires no "hashchange", so take those clicks over and switch the tab directly.
    // Capture phase runs before Next's Link handler, which skips navigation once default is prevented.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      const id = url.hash.slice(1);
      if (url.origin !== window.location.origin || url.pathname !== "/profile" || !TABS.some((t) => t.id === id)) return;
      e.preventDefault();
      setTab(id as TabId);
      window.history.replaceState(window.history.state, "", `/profile#${id}`);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  const selectTab = (id: TabId) => {
    setTab(id);
    window.history.replaceState(window.history.state, "", `/profile#${id}`);
  };

  useEffect(() => {
    api.profile().then(setP).catch((e) => setError(e.message));
    api.progress(365, today()).then((d) => setStats(d.totals)).catch(() => {});
    api.today(today()).then((t) => setStreak(t.streak)).catch(() => {});
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

  const discardRedo = async () => {
    setRestarting(true);
    setError(null);
    try {
      setP((await api.onboarding({ skip: true })).profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not discard the redo");
    } finally {
      setRestarting(false);
    }
  };

  const heightUnit = p.heightUnit ?? "cm";
  const rest = p.restDefaults ?? DEFAULT_REST;
  const usesSave = tab === "about" || tab === "prefs" || tab === "constraints";

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-volt/20 font-display text-2xl font-bold text-volt-bright">
          {(p.name || user?.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="t-workout text-fg text-3xl">{p.name || user?.name || "Profile"}</h1>
          <p className="text-sm text-ink-400">
            {p.goalKey ? GOAL_LABELS[p.goalKey] : p.goal || "No goal set"}
            {user?.createdAt ? ` · member since ${new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-6 text-center">
          <div><dt className="label">Streak</dt><dd className="font-display text-2xl font-bold text-fg">{streak ?? "–"}</dd></div>
          <div><dt className="label">Workouts</dt><dd className="font-display text-2xl font-bold text-fg">{stats?.sessions ?? "–"}</dd></div>
          <div><dt className="label">Hours</dt><dd className="font-display text-2xl font-bold text-fg">{stats ? Math.round(stats.minutes / 6) / 10 : "–"}</dd></div>
        </dl>
      </div>

      <div
        role="tablist"
        aria-label="Profile sections"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-ink-700 px-4"
        onKeyDown={(e) => {
          const i = TABS.findIndex((t) => t.id === tab);
          const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
          if (next < 0) return;
          e.preventDefault();
          selectTab(TABS[next].id);
          document.getElementById(`tab-${TABS[next].id}`)?.focus();
        }}
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition ${on ? "border-volt-bright text-fg" : "border-transparent text-ink-400 hover:text-fg"}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="space-y-6">
      {tab === "about" && (
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
          <label className="label" htmlFor="age">Age</label>
          <input id="age" type="number" min="16" max="90" className="input" value={p.age ?? ""} onChange={(e) => set("age", numOrNull(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="height">Height</label>
          <div className="flex gap-2">
            <input
              key={`h-${heightUnit}`}
              id="height"
              type="number"
              step="0.1"
              className="input"
              defaultValue={cmToDisplay(p.heightCm, heightUnit) ?? ""}
              onChange={(e) => set("heightCm", displayToCm(numOrNull(e.target.value), heightUnit))}
            />
            {(["cm", "in"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={heightUnit === u} onClick={() => set("heightUnit", u)} className={`rounded-full border px-3 text-sm ${heightUnit === u ? "border-volt-bright bg-volt-bright/10 text-fg" : "border-ink-700"}`}>
                {u}
              </button>
            ))}
          </div>
        </div>
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
      )}

      {tab === "training" && (
      <>
      {p.onboarding?.redo ? (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-volt-bright/40">
          <div>
            <h2 className="font-bold">Setup redo in progress</h2>
            <p className="text-sm text-ink-400">Your current answers and plan stay as they are until you finish the redo.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={discardRedo} disabled={restarting}>
              Discard redo
            </button>
            <button className="btn btn-primary" onClick={() => router.push("/onboarding")}>
              Continue redo
            </button>
          </div>
        </div>
      ) : (
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold">{setupDone ? "Setup" : "Finish setup"}</h2>
            <p className="text-sm text-ink-400">
              {setupDone
                ? "Answer the setup questions again to get a fresh starter plan. Nothing changes until you finish; if you stop halfway, your current setup stays."
                : "A few questions left before we build a plan around you."}
            </p>
          </div>
          <button className="btn btn-primary" onClick={openSetup} disabled={restarting}>
            {restarting && <Spinner />} {setupDone ? "Redo setup" : "Finish setup"}
          </button>
        </div>
      )}
      <div className="card text-sm">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div><dt className="label">Days per week</dt><dd>{p.daysPerWeek ?? "–"}</dd></div>
          <div><dt className="label">Session length</dt><dd>{p.sessionMinutes ? `${p.sessionMinutes} min` : "–"}</dd></div>
          <div><dt className="label">Equipment</dt><dd className="capitalize">{p.equipmentSetup?.replace("_", " ") ?? "–"}</dd></div>
          <div><dt className="label">Injuries</dt><dd className="capitalize">{p.injuries?.length ? p.injuries.map((i) => i.replace("_", " ")).join(", ") : "None"}</dd></div>
          <div><dt className="label">Diet</dt><dd className="capitalize">{p.diet?.replace("_", " ") ?? "–"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink-400">Change these with “Redo setup” above. It builds a fresh starter plan and keeps your current one in history.</p>
      </div>
      </>
      )}

      {tab === "prefs" && (
      <div className="card grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="rest-c">Rest for big lifts (seconds)</label>
          <input id="rest-c" type="number" min="15" max="600" step="15" className="input" value={rest.compound} onChange={(e) => set("restDefaults", { ...rest, compound: Number(e.target.value) || DEFAULT_REST.compound })} />
          <p className="mt-1 text-xs text-ink-400">Squats, presses, rows, pull-ups…</p>
        </div>
        <div>
          <label className="label" htmlFor="rest-i">Rest for small lifts (seconds)</label>
          <input id="rest-i" type="number" min="15" max="600" step="15" className="input" value={rest.isolation} onChange={(e) => set("restDefaults", { ...rest, isolation: Number(e.target.value) || DEFAULT_REST.isolation })} />
          <p className="mt-1 text-xs text-ink-400">Curls, raises, calves, core…</p>
        </div>
        {Object.keys(p.restOverrides ?? {}).length > 0 && (
          <div className="md:col-span-2">
            <p className="label">Per-exercise rest (set by you or the coach)</p>
            <ul className="flex flex-wrap gap-2 text-sm">
              {Object.entries(p.restOverrides ?? {}).map(([name, sec]) => (
                <li key={name} className="flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1 capitalize">
                  {name}: {sec}s
                  <button
                    aria-label={`Remove rest override for ${name}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-ink-400 hover:bg-bad/10 hover:text-bad"
                    onClick={() => {
                      const { [name]: _, ...restO } = p.restOverrides ?? {};
                      set("restOverrides", restO);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(
          [
            ["timerSound", "Beep when rest is over"],
            ["timerVibrate", "Vibrate when rest is over (phones)"],
            ["keepAwake", "Keep the screen on during a workout"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={p[k] !== false} onChange={(e) => set(k, e.target.checked)} />
            {label}
          </label>
        ))}
        <p className="text-xs text-ink-400 md:col-span-2">When the app is in the background, a browser notification tells you rest is over (if you allowed notifications).</p>
      </div>
      )}

      {tab === "constraints" && (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-400">Rules the plan checker and coach follow, e.g. an injury to work around.</p>
          <button
            className="btn btn-ghost"
            onClick={() => set("constraints", [...p.constraints, { id: crypto.randomUUID(), label: "New constraint", reason: "", keywords: [], swaps: [] }])}
          >
            + Add constraint
          </button>
        </div>
        {p.constraints.map((c, i) => (
          <div key={c.id} className="card grid gap-3 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <p className="text-sm font-semibold text-fg">{c.label || `Constraint ${i + 1}`}</p>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                aria-label={`Remove constraint ${c.label || i + 1}`}
                onClick={() => set("constraints", p.constraints.filter((_, j) => j !== i))}
              >
                <Icon name="x" size={14} /> Remove
              </button>
            </div>
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
          </div>
        ))}
        {p.constraints.length === 0 && <p className="card text-sm text-ink-400">No constraints. Add one if there&apos;s anything the plan should avoid.</p>}
      </div>
      )}

      {tab === "ai" && <AiProviderSettings />}
      {tab === "account" && <AccountSettings />}

      {usesSave && (
        <>
          <ErrorNote error={error} />
          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving && <Spinner />} Save profile
            </button>
            {saved && <span className="text-sm text-good">Saved</span>}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
