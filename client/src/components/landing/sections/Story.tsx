"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { VIDEOS, VideoSources, vars } from "../lib";

const STORY = [
  { k: "THE WEEK", color: "var(--ice)", title: "Know exactly where your week stands.", body: "The dashboard shows this week’s sessions, sets and a live score — counted only up to today, so planned workouts never show as missed." },
  { k: "TRAINING", color: "var(--accent)", title: "Every set logged. Every rep counted.", body: "Log reps, load and RPE as you train. StarkFitIQ tracks volume and shows last week’s numbers, so you know when to add weight." },
  { k: "EVENING", color: "var(--pulse)", title: "Fuel that matches the work.", body: "Log food, protein, water and sleep in seconds — or describe your day in plain words and Quick Add fills in the log." },
];

function PhoneScreen({ step }: { step: number }) {
  if (step === 0)
    return (
      <div className="ph-card">
        <div className="mono ph-k">WEEK SCORE</div>
        <div className="ph-row">
          <div className="ph-ring-wrap">
            <div className="ph-ring" style={vars({ "--p": 0.84, "--c": "var(--ice)" })} />
            <span className="disp">84</span>
          </div>
          <div className="ph-t">
            <b>3 of 4</b> sessions done
            <br />
            Overload on track
          </div>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="ph-card">
        <div className="mono ph-k">BACK SQUAT · SET 3 OF 5</div>
        <div className="ph-big disp">
          7<small>/8 reps</small>
        </div>
        <div className="ph-bar">
          <i style={{ width: "92%" }} />
        </div>
        <div className="ph-t">100 kg · last week 97.5 kg</div>
      </div>
    );
  return (
    <div className="ph-card">
      <div className="mono ph-k">TODAY’S FUEL</div>
      <div className="ph-macros">
        <div>
          <i style={{ height: "82%", background: "var(--accent)" }} />
          <span className="mono">P</span>
        </div>
        <div>
          <i style={{ height: "64%", background: "var(--ice)" }} />
          <span className="mono">C</span>
        </div>
        <div>
          <i style={{ height: "40%", background: "var(--pulse)" }} />
          <span className="mono">F</span>
        </div>
      </div>
      <div className="ph-t">Protein 128 / 150 g · 2,340 kcal</div>
    </div>
  );
}

/** `from` skips the first panels. */
export function Story({ from = 0 }: { from?: number }) {
  const STEPS = STORY.slice(from);
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => setStep(Math.min(STEPS.length - 1, Math.floor(self.progress * STEPS.length))),
    });
    return () => st.kill();
  }, []);

  return (
    <section className="story" ref={root} aria-label="A day with StarkFitIQ">
      <div className="story-sticky">
        <div className="container story-grid">
          <div className="story-text">
            <div className="story-dots" aria-hidden="true">
              {STEPS.map((s, i) => (
                <i key={s.k} className={i === step ? "on" : ""} style={vars({ "--c": s.color })} />
              ))}
            </div>
            {STEPS.map((s, i) => (
              <div key={s.k} className={`story-step ${i === step ? "on" : ""}`} aria-hidden={i !== step}>
                <div className="eyebrow mono" style={{ color: s.color }}>
                  {s.k}
                </div>
                <h2 className="h2 disp">{s.title}</h2>
                <p className="lead">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="phone-wrap">
            <div className="phone">
              <div className="phone-screen">
                <video poster={VIDEOS.phone.poster} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                  <VideoSources video={VIDEOS.phone} />
                </video>
                <div className="phone-island" />
                <div className="phone-ui">
                  <div className="mono ph-top">
                    <span className="ph-brand">
                      <span className="rec" /> STARKFITIQ
                    </span>
                    <span className="ph-steps" aria-hidden="true">
                      {STEPS.map((_, i) => (
                        <i key={i} className={i === step ? "is-active" : undefined} />
                      ))}
                    </span>
                  </div>
                  <div className="ph-swap" key={step}>
                    <PhoneScreen step={step + from} />
                  </div>
                </div>
              </div>
            </div>
            <div className="phone-glow" style={vars({ "--c": STEPS[step].color })} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
