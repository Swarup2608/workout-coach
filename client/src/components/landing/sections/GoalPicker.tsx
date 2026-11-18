"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { TRY_IT, SplitText } from "../lib";

/* Workout-status circle colours: purple strength, orange fat loss, green endurance, cyan mobility/cardio, grey rest */
type Kind = "purple" | "orange" | "green" | "cyan" | "grey";
const P: Kind = "purple",
  O: Kind = "orange",
  G: Kind = "green",
  C: Kind = "cyan",
  R: Kind = "grey";
const PLANS: Record<string, { label: string; img: string; title: string; desc: string; ai: string; days: [string, string, Kind][] }> = {
  strength: {
    label: "Build strength",
    img: TRY_IT.strength,
    title: "Strength",
    desc: "Progressive overload with heavy compound lifts, planned around your recovery.",
    ai: "Hit the top of your rep range with good form and the weekly score flags the lift for more load — no guessing.",
    days: [["MON", "Lower · Heavy squat", P], ["TUE", "Upper · Bench & row", P], ["WED", "Mobility + walk", R], ["THU", "Lower · Deadlift", P], ["FRI", "Upper · Press & pull", P], ["SAT", "Conditioning finisher", C], ["SUN", "Full rest", R]],
  },
  fat: {
    label: "Lose fat",
    img: TRY_IT.fat,
    title: "Fat loss",
    desc: "Sustainable calorie expenditure through strength training, conditioning and consistent daily movement.",
    ai: "Combine resistance training with cardiovascular activity to preserve muscle while improving fitness and supporting gradual fat loss.",
    days: [["MON", "Full body · Strength", O], ["TUE", "Cardio · Incline walk", C], ["WED", "Lower body + core", O], ["THU", "Conditioning · Intervals", C], ["FRI", "Upper body · Strength", O], ["SAT", "Long walk + mobility", C], ["SUN", "Full rest", R]],
  },
  endurance: {
    label: "Boost endurance",
    img: TRY_IT.endurance,
    title: "Endurance",
    desc: "Build cardiovascular capacity, improve stamina and sustain performance for longer.",
    ai: "Gradually increase training duration and intensity through structured aerobic sessions, interval training and strength maintenance.",
    days: [["MON", "Zone 2 · Steady cardio", G], ["TUE", "Intervals · Speed training", C], ["WED", "Full body · Strength", P], ["THU", "Zone 2 · Long endurance", G], ["FRI", "Tempo · Performance training", C], ["SAT", "Active recovery walk", R], ["SUN", "Full rest", R]],
  },
  mobility: {
    label: "Move better",
    img: TRY_IT.mobility,
    title: "Move better",
    desc: "Improve mobility, flexibility, stability and movement quality through intentional training.",
    ai: "Build better movement patterns, improve joint control and develop strength through a comfortable range of motion.",
    days: [["MON", "Lower body · Hip mobility", C], ["TUE", "Upper body · Shoulder mobility", C], ["WED", "Full body · Mobility flow", C], ["THU", "Core · Stability & balance", P], ["FRI", "Functional strength · Full body", P], ["SAT", "Yoga + stretching", C], ["SUN", "Full rest", R]],
  },
};

export function GoalPicker() {
  const [goal, setGoal] = useState("strength");
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const p = PLANS[goal];

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".gp-copy > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: "power3.out" });
      gsap.fromTo(".gp-day", { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out" });
    }, panel);
    return () => ctx.revert();
  }, [goal]);

  return (
    <section id="plans" className="gp">
      {/* Every goal photo is stacked full-bleed; the active one fades in */}
      <div className="gp-bg" aria-hidden="true">
        {Object.entries(PLANS).map(([id, g]) => (
          <img key={id} src={g.img} alt="" className={goal === id ? "is-active" : undefined} />
        ))}
      </div>
      <div className="gp-shade" aria-hidden="true" />

      <div className="container gp-inner">
        <div className="section-head center">
          <div className="eyebrow mono" data-reveal>
            TRY IT
          </div>
          <h2 className="h2 disp" data-split>
            <SplitText text="What are you training for?" />
          </h2>
          <p className="lead" data-reveal>
            Pick a goal and preview a sample week you could plan and track in StarkFitIQ.
          </p>
        </div>

        <div className="gp-tabs" role="group" aria-label="Choose a goal" data-reveal>
          {Object.entries(PLANS).map(([id, g]) => (
            <button key={id} className={`gp-tab disp ${goal === id ? "on" : ""}`} aria-pressed={goal === id} onClick={() => setGoal(id)}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="gp-panel" ref={panel} data-reveal>
          <div className="gp-copy">
            <h3 className="h3 disp">{p.title}</h3>
            <p className="lead">{p.desc}</p>
            <div className="gp-ai">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: "var(--accent)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
              <p>{p.ai}</p>
            </div>
          </div>
          <div className="gp-week glass">
            <div className="mono gp-week-k">SAMPLE WEEK</div>
            <ul className="gp-days">
              {p.days.map(([d, what, kind]) => (
                <li className="gp-day" key={goal + d}>
                  <span className="mono">{d}</span>
                  <span>{what}</span>
                  <i className={`k-${kind}`} aria-label={kind} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
