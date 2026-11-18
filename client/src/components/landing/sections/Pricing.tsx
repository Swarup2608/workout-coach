"use client";

import Link from "next/link";
import { SplitText } from "../lib";
import { useStartHref } from "../shared";

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
