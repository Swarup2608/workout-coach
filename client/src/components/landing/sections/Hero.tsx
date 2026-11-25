"use client";

import Link from "next/link";
import { HERO_REEL, VideoReel, scrollToHash } from "../lib";
import { Arrow, Spark, useStartHref } from "../shared";

/* [shown value, label, count-up target?, suffix] — the SSR text is the final value, so no-JS / reduced motion is correct */
const STATS: [string, string, number?, string?][] = [
  ["5", "signals rolled into one weekly score", 5],
  ["6+", "AI providers — bring your own key", 6, "+"],
  ["1", "plain sentence to log a whole day"],
  ["Free", "core app — no card needed"],
];

/** Video-reel background, headline, two hoverable cards over the footage, then the stats strip. */
export function Hero() {
  const start = useStartHref();
  return (
    <section id="top" className="l2-hero l3-hero home-hero">
      <div className="l3-hero-bg" aria-hidden="true">
        <VideoReel video={HERO_REEL} />
      </div>
      <div className="l2-wrap l2-hero-grid">
        <div className="l2-hero-copy">
          <h1 className="l2-h1">
            <span className="l2-line">
              <span>Train like you</span>
            </span>{" "}
            <span className="l2-line">
              <span>
                <span className="l2-mark" data-text="engineered">
                  engineered
                </span>{" "}
                it.
              </span>
            </span>
          </h1>
          <p className="l2-lead">
            Plan your week. Log every set. Get intelligent coaching that helps you build strength, improve consistency and make measurable progress.
          </p>
          <div className="l2-actions">
            <Link className="l2-btn l2-btn-primary" href={start}>
              Start free <Arrow />
            </Link>
            <a className="l2-btn l2-btn-ghost" href="#how" onClick={(e) => scrollToHash(e, "#how")}>
              See how it works
            </a>
          </div>
          <p className="l2-fine">No credit card · Bring your own AI key, or use it without one</p>
        </div>

        <div className="l2-hero-visual">
          {/* Empty stage (keeps the .l2-reel hook so the hero motion has a target); the cards float over the video */}
          <div className="l2-reel home-stage" aria-hidden="true" />
          <div className="l2-score-card" aria-hidden="true">
            <div className="l2-ring">
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
          <div className="l2-tip-card" aria-hidden="true">
            <span className="l2-tip-icon">
              <Spark />
            </span>
            <div>
              <div className="l2-k">AI coach</div>
              <p>Top of the range — squat 102.5 kg next session.</p>
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
