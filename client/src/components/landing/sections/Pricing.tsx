"use client";

import Link from "next/link";
import { Arrow, Check, useStartHref } from "../shared";

const CORE = ["Weekly plan editor", "Workout, food & daily logging", "Weekly score from the app", "History, progress & PRs"];
const WITH_AI = ["Everything in Core", "AI weekly reviews & next-week changes", "Coach chat that knows your plan and logs", "Quick Add from plain language"];

/** Two plans; the cards rise in and the featured one settles from a tilt (useScrollAnimations). */
export function Pricing() {
  const start = useStartHref();
  return (
    <section id="pricing" className="l2-section">
      <div className="l2-wrap l2-narrow">
        <div className="l2-head l2-center">
          <span className="l2-eyebrow" data-r>
            Pricing
          </span>
          <h2 className="l2-h2">Free. Bring your own AI.</h2>
        </div>
        <ul className="l3-promise" data-r>
          <li>
            <Check /> No credit card
          </li>
          <li>
            <Check /> No subscription
          </li>
          <li>
            <Check /> Your AI key, your provider, your bill
          </li>
        </ul>
        <div className="l2-prices">
          <article className="l2-price">
            <h3 className="l2-h3">Core</h3>
            <div className="l2-amount">Free</div>
            <p className="l2-muted">No credit card needed</p>
            <ul>
              {CORE.map((t) => (
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
              {WITH_AI.map((t) => (
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
      </div>
    </section>
  );
}
