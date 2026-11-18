"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { VIDEOS, VideoSources } from "../lib";

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
          { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", scrollTrigger: { trigger: root.current, start: "top 80%", end: "top top", scrub: true } }
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
      <div>
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
