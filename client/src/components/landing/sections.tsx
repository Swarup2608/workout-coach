"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useAuth } from "@/components/AuthProvider";
import { LogoMark } from "@/components/Logo";
import { PHOTOS, VIDEOS, HERO_REEL, VideoReel, VideoSources, SplitText, scrollToHash, useMagnetic, vars } from "./lib";

/** Where "start" buttons go: the dashboard when signed in, otherwise signup. */
function useStartHref() {
  const { user } = useAuth();
  return user ? "/dashboard" : "/signup";
}

const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* --------------------------------- Hero --------------------------------- */

const TIPS = ["Top of the range — add 2.5 kg to squats", "Protein ran short. Aim for 150 g", "4 of 4 sessions. Keep it rolling", "Sleep dipped — keep Thursday light"];

export function Hero({ ready }: { ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const primary = useMagnetic(0.35);
  const start = useStartHref();
  const [live, setLive] = useState({ sets: 38, sessions: 3, tip: 0, score: 86 });

  useEffect(() => {
    const id = setInterval(() => {
      setLive((s) => ({
        sets: s.sets >= 48 ? 36 : s.sets + 1,
        sessions: s.sets >= 44 ? 4 : 3,
        tip: (s.tip + 1) % TIPS.length,
        score: 82 + Math.floor(Math.random() * 10),
      }));
    }, 1700);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from(".hero-media", { scale: 1.25, duration: 2.2, ease: "power3.out" }, 0)
          .from(".hero-title .word > span", { yPercent: 115, duration: 1.3, stagger: 0.07 }, 0.15)
          .from(".hero-eyebrow, .hero-sub, .hero-actions, .hero-proof", { y: 30, opacity: 0, duration: 1.1, stagger: 0.1 }, 0.5)
          .from(".hud", { y: 60, opacity: 0, scale: 0.9, duration: 1.2, stagger: 0.12 }, 0.7);

        // Scroll-out: media zooms, copy drifts up and fades, HUD cards separate
        gsap
          .timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } })
          .to(".hero-media", { scale: 1.18, yPercent: 12, ease: "none" }, 0)
          .to(".hero-copy", { yPercent: -35, opacity: 0, ease: "none" }, 0)
          .to(".hud-a", { yPercent: -120, xPercent: -20, ease: "none" }, 0)
          .to(".hud-b", { yPercent: -60, xPercent: 25, ease: "none" }, 0)
          .to(".hud-c", { yPercent: -180, ease: "none" }, 0);
      },
      root
    );
    return () => mm.revert();
  }, [ready]);

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero-media">
        <VideoReel video={HERO_REEL} />
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="container hero-layout">
        <div className="hero-copy">
          <div className="hero-eyebrow mono">
            <span className="dot-live" /> AI WORKOUT COACH · FREE TO START
          </div>
          <h1 className="hero-title disp">
            <SplitText text="Train like you" />{" "}
            <span className="accent">
              <SplitText text="engineered" />
            </span>{" "}
            <SplitText text="it." />
          </h1>
          <p className="hero-sub">
            Plan your week, log every set, and get a weekly score with coaching on what to change next — so every rep moves you forward.
          </p>
          <div className="hero-actions">
            <Link ref={primary} className="btn btn-accent btn-lg" href={start}>
              Start free
              <Arrow />
            </Link>
            <a className="btn btn-ghost btn-lg" href="#film" onClick={(e) => scrollToHash(e, "#film")}>
              <span className="play-dot">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4l14 8-14 8z" />
                </svg>
              </span>
              Watch the film
            </a>
          </div>
          <ul className="hero-proof">
            <li>Free to start</li>
            <li>Use your own AI key</li>
            <li>Works in any browser</li>
          </ul>
        </div>

        <div className="hero-huds" aria-label="Live session preview">
          <div className="hud hud-a glass">
            <div className="hud-label mono">THIS WEEK · STRENGTH BLOCK</div>
            <div className="hud-row">
              <div>
                <div className="hud-k mono">SESSIONS</div>
                <div className="hud-v disp">
                  {live.sessions}
                  <small>/4</small>
                </div>
              </div>
              <div>
                <div className="hud-k mono">SETS</div>
                <div className="hud-v disp pulse-c">{live.sets}</div>
              </div>
              <div>
                <div className="hud-k mono">SCORE</div>
                <div className="hud-v disp accent">{live.score}</div>
              </div>
            </div>
          </div>
          <div className="hud hud-b glass">
            <div className="hud-k mono">AI COACH</div>
            <div className="hud-tip" key={live.tip}>
              {TIPS[live.tip]}
            </div>
          </div>
          <div className="hud hud-c glass">
            <div className="hud-k mono ice">OVERLOAD · BACK SQUAT</div>
            <svg width="150" height="34" viewBox="0 0 150 34" aria-hidden="true">
              <path className="ecg" d="M0 30 L25 27 L50 28 L75 21 L100 18 L125 11 L150 6" fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className="hud-v disp sm">+7.5 kg in 4 wks</div>
          </div>
        </div>
      </div>

      <div className="scroll-cue mono" aria-hidden="true">
        <span /> SCROLL
      </div>
    </section>
  );
}

/* -------------------------------- Marquee ------------------------------- */

const MA = ["Weekly plan editor", "Set-by-set logging", "Weekly scoring", "AI coach chat", "Calories & protein", "Plain-language Quick Add"];
const MB = ["Precision", "Power", "Intelligence", "Consistency", "Recovery", "Results"];

function MarqueeRow({ items, dir, outline }: { items: string[]; dir: 1 | -1; outline?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.to(ref.current, { xPercent: dir * -50, duration: 40, ease: "none", repeat: -1 });
    // Start deep into the repeat cycle so scrolling up can safely play it in reverse
    tween.totalTime(tween.duration() * 50);
    // Scroll speed and direction push the marquee
    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const v = gsap.utils.clamp(-6, 6, self.getVelocity() / 300);
        gsap.to(tween, { timeScale: (self.direction || 1) * (1 + Math.abs(v)), duration: 0.3, overwrite: true });
        gsap.to(tween, { timeScale: self.direction || 1, duration: 1.2, delay: 0.3, ease: "power2.out" });
      },
    });
    return () => {
      tween.kill();
      st.kill();
    };
  }, [dir]);
  const repeated = [...items, ...items, ...items, ...items];
  return (
    <div className={`marquee-row ${outline ? "is-outline" : ""}`}>
      <div className="marquee-track" ref={ref}>
        {repeated.map((t, i) => (
          <span key={i}>
            {t}
            <i aria-hidden="true">✦</i>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Marquee() {
  return (
    <section className="marquee" aria-label="Capabilities">
      <MarqueeRow items={MA} dir={1} />
      <MarqueeRow items={MB} dir={-1} outline />
    </section>
  );
}

/* ------------------------------ How it works ---------------------------- */

const STEPS = [
  { n: "01", t: "Set up", d: "Tell it your goal, experience, bodyweight target and any constraints — a sore knee, a bad shoulder, limited time.", img: PHOTOS.floorMobility },
  { n: "02", t: "Plan & log", d: "Start from the baseline plan or upload your own, then log sets, reps, load, cardio and food as you go.", img: PHOTOS.womanCarry },
  { n: "03", t: "Adapt", d: "Each week is scored for adherence, overload, balance and recovery, and the coach suggests what to change next week.", img: PHOTOS.barbellFloor },
];

export function HowItWorks() {
  return (
    <section id="how" className="section">
      <div className="container">
        <div className="section-head split-head">
          <div>
            <div className="eyebrow mono" data-reveal>
              HOW IT WORKS
            </div>
            <h2 className="h2 disp" data-split>
              <SplitText text="Three steps. Then it never stops learning." />
            </h2>
          </div>
          <p className="lead" data-reveal>
            You show up and train. StarkFitIQ keeps the record, does the maths and tells you what to adjust.
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <article className="step" key={s.n} data-reveal>
              <div className="step-img">
                <img src={s.img} alt="" loading="lazy" data-speed="0.6" />
              </div>
              <div className="step-body">
                <span className="step-n disp">{s.n}</span>
                <h3 className="h3 disp">{s.t}</h3>
                <p>{s.d}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------- Gallery (pinned scroll) ---------------------- */

const CARDS = [
  { img: PHOTOS.barbellFloor, tag: "STRENGTH", title: "Heavy days, dialled in", note: "Overload tracked set by set" },
  { img: PHOTOS.womanLift, tag: "TECHNIQUE", title: "Reps in the right range", note: "Rep-range quality scored weekly" },
  { img: PHOTOS.sprintStart, tag: "CARDIO", title: "Every session counts", note: "Cardio logged with calorie estimates" },
  { img: PHOTOS.kettlebell, tag: "MOBILITY", title: "Move without limits", note: "Mobility days built into your plan" },
  { img: PHOTOS.courtDark, tag: "SPORT", title: "Train for your game", note: "Write the plan your sport needs" },
  { img: PHOTOS.womanCarry, tag: "CONSISTENCY", title: "Show up. It handles the rest.", note: "Plans that fit your week" },
];

export function Gallery() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
      () => {
        const distance = () => track.current!.scrollWidth - window.innerWidth + 48;
        const tween = gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: section.current, start: "top top", end: () => "+=" + distance(), pin: true, scrub: 1, invalidateOnRefresh: true },
        });
        // Each photo drifts inside its frame as the row slides
        gsap.utils.toArray<HTMLElement>(".g-card img").forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -8 },
            { xPercent: 8, ease: "none", scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: "left right", end: "right left", scrub: true } }
          );
        });
        gsap.to(".g-progress i", {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: section.current, start: "top top", end: () => "+=" + distance(), scrub: true },
        });
      },
      section
    );
    return () => mm.revert();
  }, []);

  return (
    <section className="gallery" ref={section} aria-label="Training disciplines">
      <div className="gallery-head container">
        <div className="eyebrow mono">ONE COACH · EVERY DISCIPLINE</div>
        <div className="g-progress" aria-hidden="true">
          <i />
        </div>
      </div>
      <div className="g-track" ref={track}>
        <div className="g-intro">
          <h2 className="h2 disp">
            Built for the way <span className="accent">you</span> train.
          </h2>
          <p className="lead">Strength, cardio, mobility or sport — plan it your way and StarkFitIQ tracks and scores it.</p>
        </div>
        {CARDS.map((c, i) => (
          <article className="g-card" key={c.tag} data-cursor="DRAG">
            <img src={c.img} alt="" loading="lazy" />
            <div className="g-shade" />
            <div className="g-meta">
              <span className="g-tag mono">
                {String(i + 1).padStart(2, "0")} · {c.tag}
              </span>
              <h3 className="disp">{c.title}</h3>
              <span className="g-note">{c.note}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Features bento -------------------------- */

function FIcon({ d, color = "var(--accent)" }: { d: string; color?: string }) {
  return (
    <span className="f-icon" style={vars({ "--c": color })}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={d} />
      </svg>
    </span>
  );
}

export function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <div className="section-head center">
          <div className="eyebrow mono" data-reveal>
            THE SYSTEM
          </div>
          <h2 className="h2 disp" data-split>
            <SplitText text="A training log that coaches you back." />
          </h2>
        </div>

        <div className="bento">
          <article className="f-card f-wide" data-reveal>
            <div className="f-photo">
              <img src={PHOTOS.womanBarbell} alt="Athlete performing a barbell lift" loading="lazy" data-speed="0.8" />
              <span className="f-chip mono">SET 3 · 8 × 100 KG</span>
              <span className="f-chip f-chip-2 mono">RPE 8</span>
            </div>
            <div className="f-body">
              <FIcon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              <h3 className="h3 disp">Set-by-set logging</h3>
              <p>Your planned exercises are ready when you open the day. Tick off sets, adjust reps and load, add cardio and notes — or build a custom workout from scratch.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={PHOTOS.monoAthlete} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M3 12h4l3-8 4 16 3-8h4" color="var(--ice)" />
              <h3 className="h3 disp">Weekly score</h3>
              <p>Adherence, rep-range quality, overload, muscle balance and recovery roll into one number for the week.</p>
              <div className="meter">
                <i style={{ width: "84%" }} />
              </div>
            </div>
          </article>

          <article className="f-card" data-reveal>
            <FIcon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <h3 className="h3 disp">AI coach chat</h3>
            <p>Ask anything about your training. The coach sees your profile, plan, recent scores and logs. Use your own Claude, OpenAI, Gemini or other key.</p>
            <div className="chat-mini" aria-hidden="true">
              <span className="me">Should I deload this week?</span>
              <span>Not yet — squat volume is up 9% and your scores are holding. Deload next week.</span>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={PHOTOS.bowl} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M3 11h18M5 11a7 7 0 0 0 14 0M8 7c0-2 1-3 2-4M12 7c0-2 1-3 2-4" color="var(--pulse)" />
              <h3 className="h3 disp">Food &amp; daily stats</h3>
              <p>Log meals, calories and protein alongside bodyweight, steps, water and sleep. Cardio burn is estimated for you.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={PHOTOS.roadRun} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M13 2L3 14h9l-1 8 10-12h-9z" color="var(--ice)" />
              <h3 className="h3 disp">Quick Add</h3>
              <p>Describe your day in plain words — “squats 5×5 at 100, 30 min bike, chicken and rice” — and it becomes a saved log.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Story (sticky phone) ----------------------- */

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
        <div className="ph-ring-wrap">
          <div className="ph-ring" style={vars({ "--p": 0.84, "--c": "var(--ice)" })} />
          <span className="disp">84</span>
        </div>
        <div className="ph-t">3 of 4 sessions done · overload on track</div>
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

export function Story() {
  const root = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => setStep(Math.min(STORY.length - 1, Math.floor(self.progress * STORY.length))),
    });
    return () => st.kill();
  }, []);

  return (
    <section className="story" ref={root} aria-label="A day with StarkFitIQ">
      <div className="story-sticky">
        <div className="container story-grid">
          <div className="story-text">
            <div className="story-dots" aria-hidden="true">
              {STORY.map((s, i) => (
                <i key={s.k} className={i === step ? "on" : ""} style={vars({ "--c": s.color })} />
              ))}
            </div>
            {STORY.map((s, i) => (
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
                    <span className="rec" /> STARKFITIQ
                  </div>
                  <div className="ph-swap" key={step}>
                    <PhoneScreen step={step} />
                  </div>
                </div>
              </div>
            </div>
            <div className="phone-glow" style={vars({ "--c": STORY[step].color })} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Goal picker ---------------------------- */

type Kind = "train" | "cardio" | "rest";
const T: Kind = "train",
  C: Kind = "cardio",
  R: Kind = "rest";
const PLANS: Record<string, { label: string; img: string; title: string; desc: string; ai: string; days: [string, string, Kind][] }> = {
  strength: {
    label: "Build strength",
    img: PHOTOS.barbellFloor,
    title: "Strength block",
    desc: "Progressive overload with heavy compound lifts, planned around your recovery.",
    ai: "Hit the top of your rep range and the weekly score flags the lift for more load — no guessing.",
    days: [["MON", "Lower · Heavy squat", T], ["TUE", "Upper · Bench & row", T], ["WED", "Mobility + walk", R], ["THU", "Lower · Deadlift", T], ["FRI", "Upper · Press & pull", T], ["SAT", "Conditioning finisher", C], ["SUN", "Full rest", R]],
  },
  fat: {
    label: "Lose fat",
    img: PHOTOS.orangeTank,
    title: "Lean-out block",
    desc: "Metabolic circuits and strength work to keep muscle while you cut.",
    ai: "Calories eaten, cardio burn and protein are tallied every day, so you can see whether the deficit is real.",
    days: [["MON", "Full-body circuit", T], ["TUE", "Zone 2 cardio · 35 min", C], ["WED", "Strength · Lower", T], ["THU", "HIIT intervals", C], ["FRI", "Strength · Upper", T], ["SAT", "Long walk + stretch", R], ["SUN", "Full rest", R]],
  },
  endurance: {
    label: "Boost endurance",
    img: PHOTOS.runningField,
    title: "Engine block",
    desc: "Build an aerobic base with intervals, tempo work and supporting strength.",
    ai: "Log each run with time and distance; calorie burn is estimated from your bodyweight.",
    days: [["MON", "Easy run · Zone 2", C], ["TUE", "Strength · Legs & core", T], ["WED", "Intervals 6 × 400 m", C], ["THU", "Mobility flow", R], ["FRI", "Tempo run", C], ["SAT", "Long session", C], ["SUN", "Full rest", R]],
  },
  mobility: {
    label: "Move better",
    img: PHOTOS.floorMobility,
    title: "Move-better block",
    desc: "Joint health, flexibility and control for pain-free daily movement.",
    ai: "Add constraints to your profile — a stiff hip, a sore shoulder — and the coach works around them.",
    days: [["MON", "Hips & spine flow", R], ["TUE", "Bodyweight strength", T], ["WED", "Shoulder mobility", R], ["THU", "Balance & control", T], ["FRI", "Full-body flow", R], ["SAT", "Walk + breathwork", C], ["SUN", "Full rest", R]],
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
      gsap.fromTo(".gp-photo img", { scale: 1.15, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "expo.out" });
      gsap.fromTo(".gp-copy > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.06, ease: "power3.out" });
      gsap.fromTo(".gp-day", { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "power3.out" });
    }, panel);
    return () => ctx.revert();
  }, [goal]);

  return (
    <section id="plans" className="section">
      <div className="container">
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
          <div className="gp-photo">
            <img src={p.img} alt="" key={p.img} />
            <div className="gp-photo-label mono">SAMPLE WEEK · {p.title.toUpperCase()}</div>
          </div>
          <div className="gp-copy">
            <h3 className="h3 disp">{p.title}</h3>
            <p className="lead">{p.desc}</p>
            <div className="gp-ai">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ color: "var(--accent)" }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
              </svg>
              <p>{p.ai}</p>
            </div>
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

/* ---------------------------------- Film -------------------------------- */

const CAPTIONS = ["You log the work.", "The coach reads the week.", "You just lift."];

export function Film() {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [cap, setCap] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setCap((c) => (c + 1) % CAPTIONS.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        gsap.fromTo(
          ".film-frame",
          { clipPath: "inset(14% 20% 14% 20% round 48px)" },
          { clipPath: "inset(0% 0% 0% 0% round 28px)", ease: "none", scrollTrigger: { trigger: root.current, start: "top 80%", end: "top 10%", scrub: true } }
        );
        gsap.fromTo(".film-frame video", { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: true } });
      },
      root
    );
    return () => mm.revert();
  }, []);

  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  return (
    <section id="film" className="film" ref={root}>
      <div className="container">
        <div className="film-frame" data-cursor={muted ? "SOUND ON" : "MUTE"}>
          <video ref={video} poster={VIDEOS.film.poster} autoPlay muted loop playsInline preload="metadata">
            <VideoSources video={VIDEOS.film} />
          </video>
          <div className="film-shade" aria-hidden="true" />
          <div className="film-top mono">
            <span className="rec" /> STARKFITIQ — THE FILM
          </div>
          <div className="film-bottom">
            <h2 className="film-title disp" aria-live="polite">
              <span className="film-cap" key={cap}>
                {CAPTIONS[cap]}
              </span>
            </h2>
            <button className="btn btn-accent" onClick={toggleSound} aria-pressed={!muted}>
              {muted ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
                </svg>
              )}
              {muted ? "Sound on" : "Mute"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Pricing ------------------------------- */

const Check = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function Pricing() {
  const start = useStartHref();
  return (
    <section id="pricing" className="section section-alt">
      <div className="container narrow">
        <div className="section-head center">
          <div className="eyebrow mono" data-reveal>
            PRICING
          </div>
          <h2 className="h2 disp" data-split>
            <SplitText text="Free. Bring your own AI." />
          </h2>
        </div>
        <div className="pricing">
          <article className="price-card" data-reveal>
            <h3 className="disp">Core</h3>
            <div className="price disp">Free</div>
            <p className="muted">No card needed</p>
            <ul>
              <li>
                <Check />
                Weekly plan editor
              </li>
              <li>
                <Check />
                Workout, food &amp; daily logging
              </li>
              <li>
                <Check />
                Weekly score from the app
              </li>
              <li>
                <Check />
                History &amp; lift progress
              </li>
            </ul>
            <Link className="btn btn-ghost" href={start}>
              Start free
            </Link>
          </article>
          <article className="price-card featured" data-reveal>
            <span className="badge mono">RECOMMENDED</span>
            <h3 className="disp">Core + AI coach</h3>
            <div className="price disp">Your key</div>
            <p>Add your own AI key · you pay your provider directly</p>
            <ul>
              <li>
                <Check />
                Everything in Core
              </li>
              <li>
                <Check />
                AI weekly reviews &amp; next-week changes
              </li>
              <li>
                <Check />
                Coach chat that knows your plan and logs
              </li>
              <li>
                <Check />
                Quick Add from plain language
              </li>
            </ul>
            <Link className="btn btn-invert" href={start}>
              Get started
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- FAQ --------------------------------- */

const QA: [string, string][] = [
  ["Do I need a gym or equipment?", "No. Write your plan around whatever you have — nothing, dumbbells or a full gym — and log it the same way."],
  ["Which AI providers work?", "Claude, OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible API. Add your key in Profile. Without one, you still get the app’s own weekly scoring, plus a copy-and-paste check-in for a Claude Project."],
  ["I’m a complete beginner. Is it for me?", "Yes. Start from the baseline plan, log what you do, and the weekly score shows what to work on. The coach explains its suggestions in plain language."],
  ["Is my data private?", "Your plans, logs and scores are tied to your account and only you can see them. Your AI key is stored encrypted and used only for your own requests."],
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section">
      <div className="container faq-wrap">
        <h2 className="h2 disp center" data-reveal>
          Questions, answered.
        </h2>
        <div className="faq">
          {QA.map(([q, a], i) => (
            <div className={`faq-item ${open === i ? "on" : ""}`} key={q} data-reveal>
              <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{q}</span>
                <span className="faq-plus" aria-hidden="true" />
              </button>
              <div className="faq-a">
                <div>
                  <p>{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- CTA --------------------------------- */

export function CTA() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const btn = useMagnetic<HTMLButtonElement>(0.3);

  // Hands the email to the signup form, which pre-fills it.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    router.push(/^\S+@\S+\.\S+$/.test(v) ? `/signup?email=${encodeURIComponent(v)}` : "/signup");
  };

  return (
    <section id="download" className="cta">
      <div className="cta-bg">
        <img src={PHOTOS.gymInterior} alt="" loading="lazy" data-speed="1.2" />
      </div>
      <div className="cta-shade" aria-hidden="true" />
      <div className="container cta-inner">
        <div data-reveal>
          <LogoMark size={92} className="cta-mark" />
        </div>
        <h2 className="cta-title disp" data-reveal>
          Your body.
          <br />
          <span className="accent">Engineered.</span>
        </h2>
        {user ? (
          <>
            <p className="lead" data-reveal>
              Your plan, logs and scores are waiting.
            </p>
            <div className="cta-form" data-reveal>
              <Link className="btn btn-accent btn-lg" href="/dashboard">
                Open your dashboard
                <Arrow />
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="lead" data-reveal>
              Create your free account and train with StarkFitIQ today.
            </p>
            <form className="cta-form" onSubmit={submit} data-reveal>
              <label htmlFor="cta-email" className="sr-only">
                Email address
              </label>
              <input id="cta-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button ref={btn} className="btn btn-accent btn-lg" type="submit">
                Get started
              </button>
            </form>
            <p className="cta-note" data-reveal>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
