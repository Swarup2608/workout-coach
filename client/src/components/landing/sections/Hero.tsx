"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { HERO_CLIPS, SlideVideos, SplitText, scrollToHash, useMagnetic } from "../lib";
import { Arrow, useStartHref } from "../shared";

const SLIDES = [
  { tag: "Overview", k: "WEEKLY SCORE", v: "86", pre: "Train like you", accent: "engineered", post: "it.", sub: "Plan your week, log every set, and get a weekly score with coaching on what to change next — so every rep moves you forward." },
  { tag: "Strength", k: "BACK SQUAT", v: "+7.5 kg", pre: "Every rep,", accent: "on the", post: "record.", sub: "Log sets in seconds and watch your heavy lifts climb week over week." },
  { tag: "Volume", k: "SETS THIS WEEK", v: "42", pre: "Smarter", accent: "volume,", post: "less guesswork.", sub: "Your plan balances push, pull and legs so no muscle group gets left behind." },
  { tag: "Cardio", k: "TRACK SESSION", v: "5.2 km", pre: "Cardio that", accent: "fits", post: "the plan.", sub: "Runs and conditioning sit alongside your lifting, scored in the same weekly view." },
  { tag: "Recovery", k: "SLEEP AVG", v: "7.4 h", pre: "Recover to", accent: "come back", post: "stronger.", sub: "Mobility and sleep feed your score, so the coach knows when to push and when to ease off." },
  { tag: "AI Coach", k: "NEXT STEP", v: "+2.5 kg", pre: "Coaching that", accent: "adapts", post: "to you.", sub: "Your AI coach reads sessions, nutrition and sleep, then tells you exactly what to change next." },
  { tag: "Nutrition", k: "PROTEIN", v: "150 g", pre: "Fuel the", accent: "work", post: "you do.", sub: "Track calories and protein in plain language and see how they line up with your training." },
];

const TIPS = ["Top of the range — add 2.5 kg to squats", "Protein ran short. Aim for 150 g", "4 of 4 sessions. Keep it rolling", "Sleep dipped — keep Thursday light"];


export function Hero({ ready }: { ready: boolean }) {
  const root = useRef<HTMLElement>(null);
  const primary = useMagnetic(0.35);
  const start = useStartHref();
  const [slide, setSlide] = useState(0);
  const [progress, setProgress] = useState(0);
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
  const go = (i: number) => {
    setProgress(0);
    setSlide((i + SLIDES.length) % SLIDES.length);
  };

  useEffect(() => {
    if (!ready) return;
    const mm = gsap.matchMedia();
    mm.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
        tl.from(".hero-media", { scale: 1.25, duration: 2.2, ease: "power3.out" }, 0)
          .from(".hero-title .word > span", { yPercent: 115, duration: 1.3, stagger: 0.07 }, 0.15)
          .from(".hero-actions, .hero-nav", { y: 30, opacity: 0, duration: 1.1, stagger: 0.1 }, 0.5)
          .from(".hud", { y: 60, opacity: 0, scale: 0.9, duration: 1.2, stagger: 0.12 }, 0.7);

        gsap
          .timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } })
          .to(".hero-media", { scale: 1.18, yPercent: 12, ease: "none" }, 0)
          .to(".hero-copy", { yPercent: -25, opacity: 0, ease: "none" }, 0)
          .to(".hud-a", { yPercent: -120, xPercent: -20, ease: "none" }, 0)
          .to(".hud-b", { yPercent: -60, xPercent: 25, ease: "none" }, 0)
          .to(".hud-c", { yPercent: -180, ease: "none" }, 0);
      },
      root
    );
    return () => mm.revert();
  }, [ready]);

  const cur = SLIDES[slide];

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero-media">
        <SlideVideos sources={HERO_CLIPS} poster="/media/gym-interior.jpg" index={slide} onEnded={() => go(slide + 1)} onProgress={setProgress} />
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />

      <div className="container hero-layout" role="region" aria-roledescription="carousel" aria-label="Highlights">
        <div className="hero-copy">
          <div className="hero-slides" aria-live="off">
            {SLIDES.map((sl, i) => (
              <div key={i} className={`hero-slide${i === slide ? " is-active" : ""}`} aria-hidden={i !== slide} role="group" aria-label={`${i + 1} of ${SLIDES.length}`}>
                <h1 className="hero-title disp">
                  <SplitText text={sl.pre} />{" "}
                  <span className="accent">
                    <SplitText text={sl.accent} />
                  </span>{" "}
                  <SplitText text={sl.post} />
                </h1>
                <p className="hero-sub">{sl.sub}</p>
              </div>
            ))}
          </div>

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

          <div className="hero-nav">
            <button type="button" className="hero-arrow" aria-label="Previous slide" onClick={() => go(slide - 1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" className="hero-arrow" aria-label="Next slide" onClick={() => go(slide + 1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
            <div className="hero-segs">
              {SLIDES.map((sl, i) => (
                <button key={sl.tag} type="button" className="hero-seg" aria-label={`Go to ${sl.tag}`} aria-current={i === slide} onClick={() => go(i)}>
                  <i style={{ width: i === slide ? `${Math.round(progress * 100)}%` : i < slide ? "100%" : "0%" }} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="hero-huds" aria-label="Live session preview">
          <div className="hud hud-a glass">
            <div className="hud-label mono">THIS WEEK · {cur.tag.toUpperCase()}</div>
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
            <div className="hud-k mono ice" key={slide}>{cur.k}</div>
            <svg width="150" height="34" viewBox="0 0 150 34" aria-hidden="true">
              <path className="ecg" d="M0 30 L25 27 L50 28 L75 21 L100 18 L125 11 L150 6" fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <div className="hud-v disp sm">{cur.v}</div>
          </div>
        </div>
      </div>

      <div className="scroll-cue mono" aria-hidden="true">
        <span /> SCROLL
      </div>
    </section>
  );
}
