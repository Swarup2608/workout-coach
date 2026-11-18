"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Diet, EquipmentSetup, ExperienceLevel, GoalKey, Injury, Profile, SessionMinutes, Sex, Units, WorkoutPlan } from "@/lib/domain";
import { api, authApi, type OnboardingAnswers } from "@/lib/api";
import { fromDisplay, setUnitsLocally, toDisplay, unitLabel } from "@/lib/units";
import { useAuth } from "@/components/AuthProvider";
import { AiProviderSettings } from "@/components/AiProviderSettings";
import { ErrorNote } from "@/components/ui";
import { Option, Pill, Progress, StepShell } from "@/components/onboarding/StepShell";
import { PlanReveal } from "@/components/onboarding/PlanReveal";
import {
  DAY_OPTIONS,
  DIET_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  INJURY_OPTIONS,
  MINUTE_OPTIONS,
  STEPS,
  TOTAL_STEPS,
} from "@/components/onboarding/steps";

const LEVELS: ExperienceLevel[] = ["Beginner", "Intermediate", "Advanced"];

/** Local form state; weights are kept as typed text in the user's unit. */
interface Draft {
  name: string;
  age: string;
  goalKey: GoalKey | null;
  sex: Sex | null;
  heightCm: string;
  weight: string;
  target: string;
  units: Units;
  experience: ExperienceLevel | null;
  daysPerWeek: number | null;
  sessionMinutes: SessionMinutes | null;
  equipmentSetup: EquipmentSetup | null;
  injuries: Injury[];
  diet: Diet | null;
}

const str = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (s: string) => (s.trim() === "" || !Number.isFinite(Number(s)) ? null : Number(s));

function draftFrom(p: Profile, accountName: string): Draft {
  const units = p.units ?? "kg";
  return {
    name: accountName || p.name,
    age: str(p.age),
    goalKey: p.goalKey ?? null,
    sex: p.sex ?? null,
    heightCm: str(p.heightCm),
    weight: str(toDisplay(p.startBodyweightKg, units)),
    target: str(toDisplay(p.targetBodyweightKg, units)),
    units,
    // Seeded profiles say "Intermediate" without the user choosing; only preselect once they've passed step 5.
    experience: (p.onboarding?.step ?? 0) >= 5 && LEVELS.includes(p.experience as ExperienceLevel) ? (p.experience as ExperienceLevel) : null,
    daysPerWeek: p.daysPerWeek ?? null,
    sessionMinutes: p.sessionMinutes ?? null,
    equipmentSetup: p.equipmentSetup ?? null,
    injuries: p.injuries ?? [],
    diet: p.diet ?? null,
  };
}

const inRange = (v: number | null, lo: number, hi: number) => v == null || (v >= lo && v <= hi);

export default function OnboardingPage() {
  const router = useRouter();
  const { user, reload } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [d, setD] = useState<Draft | null>(null);
  const [step, setStep] = useState(3);
  const [reached, setReached] = useState(2);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .profile()
      .then((p) => {
        setProfile(p);
        setD(draftFrom(p, user?.name ?? ""));
        const o = p.onboarding;
        const r = o && !o.completedAt ? o.step : 2;
        setReached(r);
        setStep(Math.min(TOTAL_STEPS, Math.max(3, r + 1)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load your profile"));
    // user?.name only seeds the form once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (plan) return <Page><PlanReveal plan={plan} /></Page>;
  if (!profile || !d) return <Page><div className="card mt-6">{error ? <ErrorNote error={error} /> : "Loading…"}</div></Page>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD({ ...d, [k]: v });
  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.scrollTo({ top: 0 });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  /** Saves this step's answers and moves on. */
  const save = (n: number, answers: OnboardingAnswers) =>
    run(async () => {
      const r = await api.onboarding({ step: n, answers });
      setProfile(r.profile);
      setReached(Math.max(reached, n));
      go(Math.min(TOTAL_STEPS, n + 1));
    });

  const finish = () =>
    run(async () => {
      const r = await api.onboarding({ complete: true });
      setProfile(r.profile);
      if (r.plan) setPlan(r.plan);
      window.scrollTo({ top: 0 });
    });

  const skipSetup = () =>
    run(async () => {
      await api.onboarding({ skip: true });
      router.push("/dashboard");
    });

  const changeUnits = (u: Units) => {
    if (u === d.units) return;
    // Convert what's typed so the same weight stays on screen in the new unit.
    const conv = (s: string) => str(toDisplay(fromDisplay(num(s), d.units), u));
    setD({ ...d, units: u, weight: conv(d.weight), target: conv(d.target) });
    setUnitsLocally(u);
    api.onboarding({ step: 4, answers: { units: u } }).catch(() => {});
  };

  const common = { error, busy, onSkipSetup: skipSetup, onBack: step > 1 ? () => go(step - 1) : undefined };
  const def = STEPS[step - 1];
  const ageN = num(d.age);
  const heightN = num(d.heightCm);
  const weightKg = fromDisplay(num(d.weight), d.units);
  const targetKg = fromDisplay(num(d.target), d.units);

  let body: React.ReactNode;
  switch (def.key) {
    case "account":
      body = (
        <StepShell {...common} title="Account" subtitle="Done when you signed up." onContinue={() => go(2)}>
          <div>
            <span className="label">Email</span>
            <p className="input bg-transparent text-ink-400">{user?.email ?? "—"}</p>
          </div>
        </StepShell>
      );
      break;

    case "basics": {
      const ageOk = ageN != null && Number.isInteger(ageN) && ageN >= 16 && ageN <= 90;
      body = (
        <StepShell
          {...common}
          title="Basics"
          subtitle="Done when you signed up. Change anything here."
          canContinue={!!d.name.trim() && ageOk}
          onContinue={() =>
            run(async () => {
              if (d.name.trim() !== (user?.name ?? "")) {
                await authApi.updateMe(d.name.trim());
                await reload();
              }
              if (ageN !== profile.age) setProfile(await api.saveProfile({ ...profile, age: ageN }));
              go(3);
            })
          }
        >
          <div>
            <label className="label" htmlFor="ob-name">Name</label>
            <input id="ob-name" className="input" maxLength={80} value={d.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ob-age">Age</label>
            <input id="ob-age" type="number" inputMode="numeric" min={16} max={90} className="input" value={d.age} onChange={(e) => set("age", e.target.value)} />
            {!ageOk && <p className="mt-1 text-xs text-warn">Enter your age (16–90)</p>}
          </div>
        </StepShell>
      );
      break;
    }

    case "goal":
      body = (
        <StepShell {...common} title="What's your main goal?" subtitle="This sets your sets, reps, rest and cardio." canContinue={!!d.goalKey} onContinue={() => save(3, { goalKey: d.goalKey })}>
          <div className="grid gap-2">
            {GOAL_OPTIONS.map((o) => (
              <Option key={o.value} selected={d.goalKey === o.value} onClick={() => set("goalKey", o.value)} label={o.label} hint={o.hint} />
            ))}
          </div>
        </StepShell>
      );
      break;

    case "body": {
      const u = unitLabel(d.units);
      const [lo, hi] = d.units === "lb" ? [44, 880] : [20, 400];
      const valid = inRange(heightN, 100, 250) && inRange(num(d.weight), lo, hi) && inRange(num(d.target), lo, hi);
      body = (
        <StepShell
          {...common}
          title="About your body"
          subtitle="Used for calorie estimates and progress. All optional."
          canContinue={valid}
          onContinue={() => save(4, { sex: d.sex, heightCm: heightN, startBodyweightKg: weightKg, targetBodyweightKg: targetKg, units: d.units })}
        >
          <fieldset>
            <legend className="label">Weight unit</legend>
            <div className="flex gap-2">
              <Pill selected={d.units === "kg"} onClick={() => changeUnits("kg")}>kg</Pill>
              <Pill selected={d.units === "lb"} onClick={() => changeUnits("lb")}>lb</Pill>
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Sex (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {(["male", "female", "other"] as Sex[]).map((s) => (
                <Pill key={s} selected={d.sex === s} onClick={() => set("sex", d.sex === s ? null : s)}>
                  {s[0].toUpperCase() + s.slice(1)}
                </Pill>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="ob-height">Height (cm)</label>
              <input id="ob-height" type="number" inputMode="decimal" className="input" value={d.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ob-weight">Current weight ({u})</label>
              <input id="ob-weight" type="number" inputMode="decimal" step="0.1" className="input" value={d.weight} onChange={(e) => set("weight", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ob-target">Target weight ({u})</label>
              <input id="ob-target" type="number" inputMode="decimal" step="0.1" className="input" value={d.target} onChange={(e) => set("target", e.target.value)} />
            </div>
          </div>
          {!valid && <p className="text-xs text-warn">Height 100–250 cm; weights {lo}–{hi} {u}.</p>}
        </StepShell>
      );
      break;
    }

    case "training":
      body = (
        <StepShell
          {...common}
          title="How do you train?"
          canContinue={!!d.experience && !!d.daysPerWeek && !!d.sessionMinutes}
          onContinue={() => save(5, { experience: d.experience!, daysPerWeek: d.daysPerWeek, sessionMinutes: d.sessionMinutes })}
        >
          <fieldset>
            <legend className="label">Experience</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {EXPERIENCE_OPTIONS.map((o) => (
                <Option key={o.value} selected={d.experience === o.value} onClick={() => set("experience", o.value)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Training days per week</legend>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map((n) => (
                <Pill key={n} selected={d.daysPerWeek === n} onClick={() => set("daysPerWeek", n)} label={`${n} days`}>{n}</Pill>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Minutes per session</legend>
            <div className="flex flex-wrap gap-2">
              {MINUTE_OPTIONS.map((n) => (
                <Pill key={n} selected={d.sessionMinutes === n} onClick={() => set("sessionMinutes", n)} label={`${n} minutes`}>{n} min</Pill>
              ))}
            </div>
          </fieldset>
        </StepShell>
      );
      break;

    case "equipment":
      body = (
        <StepShell
          {...common}
          title="Equipment and limits"
          subtitle="We'll leave out exercises that load an area you want to protect."
          canContinue={!!d.equipmentSetup}
          onContinue={() => save(6, { equipmentSetup: d.equipmentSetup, injuries: d.injuries })}
        >
          <fieldset>
            <legend className="label">Where do you train?</legend>
            <div className="grid gap-2">
              {EQUIPMENT_OPTIONS.map((o) => (
                <Option key={o.value} selected={d.equipmentSetup === o.value} onClick={() => set("equipmentSetup", o.value)} label={o.label} hint={o.hint} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Injuries or areas to protect (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {INJURY_OPTIONS.map((o) => {
                const on = d.injuries.includes(o.value);
                return (
                  <Pill key={o.value} selected={on} onClick={() => set("injuries", on ? d.injuries.filter((x) => x !== o.value) : [...d.injuries, o.value])}>
                    {o.label}
                  </Pill>
                );
              })}
            </div>
          </fieldset>
        </StepShell>
      );
      break;

    case "diet":
      body = (
        <StepShell {...common} title="How do you eat?" subtitle="Saved for nutrition features coming soon." onSkipStep={() => save(7, {})} canContinue={!!d.diet} onContinue={() => save(7, { diet: d.diet })}>
          <div className="grid gap-2 sm:grid-cols-2">
            {DIET_OPTIONS.map((o) => (
              <Option key={o.value} selected={d.diet === o.value} onClick={() => set("diet", o.value)} label={o.label} />
            ))}
          </div>
        </StepShell>
      );
      break;

    case "ai":
      body = (
        <StepShell
          {...common}
          title="AI coach (optional)"
          subtitle="Add your own AI key to unlock the coach chat and AI weekly scoring. Your plan doesn't need it."
          onSkipStep={finish}
          skipLabel="Skip for now"
          continueLabel="Finish and see my plan"
          onContinue={finish}
          asForm={false}
        >
          <AiProviderSettings />
        </StepShell>
      );
      break;
  }

  return (
    <Page>
      <Progress current={step} reached={reached} skipped={reached >= 7 && !profile.diet ? [7] : []} onJump={go} />
      {body}
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-2xl">{children}</div>;
}
