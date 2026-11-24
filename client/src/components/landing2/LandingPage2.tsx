"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HERO_REEL, SYSTEM, VideoReel, scrollToHash } from "../landing/lib";
import { Arrow, useStartHref } from "../landing/shared";
import { PLANS, type Kind } from "../landing/sections/GoalPicker";
import { useScrollAnimations } from "./useScrollAnimations";
import "./landing2.css";

/* ------------------------------------------------------------------ data */

const NAV: [string, string][] = [
  ["#how", "How it works"],
  ["#features", "Features"],
  ["#goals", "Goals"],
  ["#pricing", "Pricing"],
];

/* [shown value, label, count-up target?, suffix] — the SSR text is the final value, so no-JS / reduced motion is correct */
const STATS: [string, string, number?, string?][] = [
  ["5", "signals rolled into one weekly score", 5],
  ["6+", "AI providers — bring your own key", 6, "+"],
  ["1", "plain sentence to log a whole day"],
  ["Free", "core app — no card needed"],
];

const STEPS = [
  { n: "01", title: "Plan your week", body: "Start from a baseline plan or build your own around the kit you have — nothing, dumbbells or a full gym.", tone: "orange" },
  { n: "02", title: "Log every set", body: "Open the day and your exercises are waiting. Tick sets, adjust reps, load and RPE, add cardio and food.", tone: "green" },
  { n: "03", title: "Get your score", body: "One weekly number, plus coaching on exactly what to change next week — more load, more protein, or a lighter day.", tone: "sky" },
];

const FEATURES = [
  { img: SYSTEM.setBySet, alt: "Set-by-set workout log screen", title: "Set-by-set logging", body: "Planned exercises ready when you open the day. Tick sets, tweak reps and load, add notes or build a custom workout.", wide: true },
  { img: SYSTEM.weekly, alt: "Weekly score screen", title: "Weekly score", body: "Adherence, rep quality, overload, balance and recovery in one number." },
  { img: SYSTEM.aiChat, alt: "AI coach chat screen", title: "AI coach chat", body: "Ask anything. The coach sees your plan, scores and logs." },
  { img: SYSTEM.food, alt: "Food and daily stats screen", title: "Food & daily stats", body: "Meals, protein, water, steps and sleep beside your training." },
  { img: SYSTEM.quickAdd, alt: "Quick Add screen", title: "Quick Add", body: "“Squats 5×5 at 100, 30 min bike, chicken and rice” becomes a saved log." },
];

const SCORE = [
  { k: "Adherence", v: 92, note: "3 of 4 sessions — counted only up to today" },
  { k: "Rep-range quality", v: 84, note: "Most sets landed in the target range" },
  { k: "Progressive overload", v: 78, note: "Squat up 2.5 kg on last week" },
  { k: "Muscle balance", v: 88, note: "Push, pull and legs evenly covered" },
  { k: "Recovery", v: 71, note: "Sleep dipped mid-week — keep Thursday light" },
];

const KIND_LABEL: Record<Kind, string> = { purple: "Strength", orange: "Fat loss", green: "Endurance", cyan: "Mobility / cardio", grey: "Rest" };

const PROVIDERS = ["Claude", "OpenAI", "Gemini", "Groq", "Mistral", "OpenRouter", "Any OpenAI-compatible API"];

const QA: [string, string][] = [
  ["Do I need a gym or equipment?", "No. Write your plan around whatever you have — nothing, dumbbells or a full gym — and log it the same way."],
  ["Which AI providers work?", "Claude, OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible API. Add your key in Profile. Without one, you still get the app’s own weekly scoring, plus a copy-and-paste check-in for a Claude Project."],
  ["I’m a complete beginner. Is it for me?", "Yes. Start from the baseline plan, log what you do, and the weekly score shows what to work on. The coach explains its suggestions in plain language."],
  ["Is my data private?", "Your plans, logs and scores are tied to your account and only you can see them. Your AI key is stored encrypted and used only for your own requests."],
];

/* ------------------------------------------------------------- helpers */

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const Spark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
  </svg>
);

/* ------------------------------------------------------------ sections */

function Nav() {
  const start = useStartHref();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={`l2-nav${scrolled ? " is-scrolled" : ""}`}>
      <div className="l2-wrap l2-nav-in">
        <a className="l2-brand" href="#top" onClick={(e) => scrollToHash(e, "#top")} aria-label="StarkFitIQ home">
          <Logo size={26} />
        </a>
        <nav aria-label="Sections">
          <ul className="l2-nav-links">
            {NAV.map(([h, label]) => (
              <li key={h}>
                <a href={h} onClick={(e) => scrollToHash(e, h)}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="l2-nav-cta">
          <ThemeToggle className="l2-theme" />
          <Link className="l2-link" href="/login">
            Log in
          </Link>
          <Link className="l2-btn l2-btn-primary l2-btn-sm" href={start}>
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const start = useStartHref();
  return (
    <section id="top" className="l2-hero">
      <div className="l2-wrap l2-hero-grid">
        <div className="l2-hero-copy">
          <h1 className="l2-h1">
            <span className="l2-line">
              <span>Plan it.</span>
            </span>{" "}
            <span className="l2-line">
              <span>Log it.</span>
            </span>{" "}
            <span className="l2-line">
              <span className="l2-mark" data-text="Score it.">Score it.</span>
            </span>
          </h1>
          <p className="l2-lead">
            StarkFitIQ plans your week, logs every set, and hands you a weekly score with coaching on exactly what to change next — so every rep moves you forward.
          </p>
          <div className="l2-actions">
            <Link className="l2-btn l2-btn-primary" href={start}>
              Start free <Arrow />
            </Link>
            <a className="l2-btn l2-btn-ghost" href="#how" onClick={(e) => scrollToHash(e, "#how")}>
              See how it works
            </a>
          </div>
          <p className="l2-fine">
            No card needed · Works with or without an AI key
          </p>
        </div>

        <div className="l2-hero-visual">
          <div className="l2-reel">
            <VideoReel video={HERO_REEL} />
          </div>
          <div className="l2-score-card" aria-label="Example weekly score: 86">
            <div className="l2-ring" aria-hidden="true">
              <span>86</span>
            </div>
            <div>
              <div className="l2-k">Weekly score</div>
              <div className="l2-score-row">
                <span>
                  <b>3/4</b> sessions
                </span>
                <span>
                  <b>42</b> sets
                </span>
              </div>
            </div>
          </div>
          <div className="l2-tip-card">
            <span className="l2-tip-icon">
              <Spark />
            </span>
            <div>
              <div className="l2-k">AI coach</div>
              <p>Top of the range — add 2.5 kg to squats.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="l2-wrap">
        <ul className="l2-stats">
          {STATS.map(([v, k, to, suffix]) => (
            <li key={k}>
              <b data-count={to} data-suffix={suffix}>
                {v}
              </b>
              <span>{k}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="l2-section">
      <div className="l2-wrap">
        <div className="l2-head">
          <span className="l2-eyebrow" data-r>
            How it works
          </span>
          <h2 className="l2-h2">
            Three steps. Every week.
          </h2>
        </div>
        <ol className="l2-steps">
          {STEPS.map((s) => (
            <li key={s.n} className={`l2-step l2-tone-${s.tone}`}>
              <span className="l2-step-n">{s.n}</span>
              <h3 className="l2-h3">{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="l2-section l2-alt">
      <div className="l2-wrap">
        <div className="l2-head l2-head-split">
          <div>
            <span className="l2-eyebrow" data-r>
              The system
            </span>
            <h2 className="l2-h2">
              A training log that coaches you back.
            </h2>
          </div>
          <p className="l2-lead" data-r>
            Everything you log feeds one place — so the coach can tell you what to do next, not just what you did.
          </p>
        </div>
        <div className="l2-bento">
          {FEATURES.map((f) => (
            <article key={f.title} className={`l2-card${f.wide ? " is-wide" : ""}`}>
              <div className="l2-card-img">
                <img src={f.img} alt={f.alt} loading="lazy" />
              </div>
              <div className="l2-card-body">
                <h3 className="l2-h3">{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Score() {
  return (
    <section className="l2-section">
      <div className="l2-wrap l2-score-grid">
        <div>
          <span className="l2-eyebrow" data-r>
            The weekly score
          </span>
          <h2 className="l2-h2">
            One number. Five reasons behind it.
          </h2>
          <p className="l2-lead" data-r>
            Your score is counted only up to today, so planned workouts never show as missed. Each part tells you where the next point comes from.
          </p>
          <div className="l2-big-score" data-r aria-label="Example total: 83 out of 100">
            <b data-count={83}>83</b>
            <span>/ 100 this week</span>
          </div>
        </div>
        <ul className="l2-meters" aria-label="Example score breakdown">
          {SCORE.map((s) => (
            <li key={s.k}>
              <div className="l2-meter-top">
                <span>{s.k}</span>
                <b>{s.v}</b>
              </div>
              <div className="l2-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.v} aria-label={s.k}>
                <i style={{ width: `${s.v}%` }} />
              </div>
              <p>{s.note}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Goals() {
  const [goal, setGoal] = useState("strength");
  const p = PLANS[goal];
  const panel = useRef<HTMLDivElement>(null);
  const shown = useRef(goal);

  // Switching goals re-cascades the caption and the sample-week rows.
  // Compares against the last goal shown (not a "first run" flag) so React's dev double-run of effects doesn't fire it on mount.
  useEffect(() => {
    if (shown.current === goal) return;
    shown.current = goal;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".l2-goal-cap > *", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out", stagger: 0.05 });
      gsap.fromTo(".l2-week li", { x: 20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: "power3.out", stagger: 0.04 });
      gsap.fromTo(".l2-ai", { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", delay: 0.2 });
    }, panel);
    return () => ctx.revert();
  }, [goal]);
  return (
    <section id="goals" className="l2-section l2-alt">
      <div className="l2-wrap">
        <div className="l2-head">
          <span className="l2-eyebrow" data-r>
            Try it
          </span>
          <h2 className="l2-h2">
            What are you training for?
          </h2>
        </div>
        <div className="l2-tabs" role="group" aria-label="Choose a goal" data-r>
          {Object.entries(PLANS).map(([id, g]) => (
            <button key={id} type="button" className="l2-tab" aria-pressed={goal === id} onClick={() => setGoal(id)}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="l2-goal" ref={panel}>
          <div className="l2-goal-img">
            {Object.entries(PLANS).map(([id, g]) => (
              <img key={id} src={g.img} alt="" className={goal === id ? "is-on" : undefined} loading="lazy" />
            ))}
            <div className="l2-goal-cap">
              <h3 className="l2-h3">{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          </div>
          <div className="l2-week">
            <div className="l2-k">Sample week</div>
            <ul>
              {p.days.map(([d, what, kind]) => (
                <li key={goal + d}>
                  <span className="l2-day">{d}</span>
                  <span className="l2-what">{what}</span>
                  <span className={`l2-kind k-${kind}`}>{KIND_LABEL[kind]}</span>
                </li>
              ))}
            </ul>
            <div className="l2-ai">
              <Spark />
              <p>{p.ai}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const start = useStartHref();
  return (
    <section id="pricing" className="l2-section">
      <div className="l2-wrap l2-narrow">
        <div className="l2-head l2-center">
          <span className="l2-eyebrow" data-r>
            Pricing
          </span>
          <h2 className="l2-h2">
            Free. Bring your own AI.
          </h2>
        </div>
        <div className="l2-prices">
          <article className="l2-price">
            <h3 className="l2-h3">Core</h3>
            <div className="l2-amount">Free</div>
            <p className="l2-muted">No card needed</p>
            <ul>
              {["Weekly plan editor", "Workout, food & daily logging", "Weekly score from the app", "History & lift progress"].map((t) => (
                <li key={t}>
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
            <Link className="l2-btn l2-btn-ghost" href={start}>
              Start free
            </Link>
          </article>
          <article className="l2-price is-featured">
            <span className="l2-badge">Recommended</span>
            <h3 className="l2-h3">Core + AI coach</h3>
            <div className="l2-amount">Your key</div>
            <p>You pay your AI provider directly</p>
            <ul>
              {["Everything in Core", "AI weekly reviews & next-week changes", "Coach chat that knows your plan and logs", "Quick Add from plain language"].map((t) => (
                <li key={t}>
                  <Check />
                  {t}
                </li>
              ))}
            </ul>
            <Link className="l2-btn l2-btn-dark" href={start}>
              Get started <Arrow />
            </Link>
          </article>
        </div>
        <div className="l2-providers" data-r>
          <span className="l2-k">Works with</span>
          <ul>
            {PROVIDERS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="l2-section l2-alt">
      <div className="l2-wrap l2-narrow l2-faq-grid">
        <h2 className="l2-h2">
          Questions, answered.
        </h2>
        <div className="l2-faq">
          {QA.map(([q, a], i) => (
            <details key={q} open={i === 0} data-r>
              <summary>
                <span>{q}</span>
                <span className="l2-plus" aria-hidden="true" />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const start = useStartHref();
  return (
    <section className="l2-section l2-cta-wrap">
      <div className="l2-wrap">
        <div className="l2-cta">
          <div>
            <h2 className="l2-h2">Your next PR starts with this week’s plan.</h2>
            <p>Set it up in a few minutes. Your first weekly score lands at the end of the week.</p>
          </div>
          <Link className="l2-btn l2-btn-dark l2-btn-lg" href={start}>
            Start free <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="l2-footer">
      <div className="l2-wrap l2-footer-in">
        <Logo size={22} />
        <nav aria-label="Footer">
          <Link href="/disciplines">Guides</Link>
          <Link href="/login">Log in</Link>
          <Link href="/">Original landing</Link>
        </nav>
        <span className="l2-muted">© {new Date().getFullYear()} StarkFitIQ</span>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- page */

export default function LandingPage2() {
  useScrollAnimations();

  return (
    <div className="l2">
      <a className="l2-skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <How />
        <Features />
        <Score />
        <Goals />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
