"use client";

/* eslint-disable @next/next/no-img-element */
import { PHOTOS, SYSTEM, SplitText, vars } from "../lib";

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
          <article className="f-card f-photo-card" data-reveal>
            <img src={SYSTEM.setBySet} alt="Logging a workout set by set" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              <h3 className="h3 disp">Set-by-set logging</h3>
              <p>Your planned exercises are ready when you open the day. Tick off sets, adjust reps and load, add cardio and notes — or build a custom workout from scratch.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={SYSTEM.weekly} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M3 12h4l3-8 4 16 3-8h4" color="var(--ice)" />
              <h3 className="h3 disp">Weekly score</h3>
              <p>Adherence, rep-range quality, overload, muscle balance and recovery roll into one number for the week.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={SYSTEM.aiChat} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <h3 className="h3 disp">AI coach chat</h3>
              <p>Ask anything about your training. The coach sees your profile, plan, recent scores and logs. Use your own Claude, OpenAI, Gemini or other key.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={SYSTEM.food} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M3 11h18M5 11a7 7 0 0 0 14 0M8 7c0-2 1-3 2-4M12 7c0-2 1-3 2-4" color="var(--pulse)" />
              <h3 className="h3 disp">Food &amp; daily stats</h3>
              <p>Log meals, calories and protein alongside bodyweight, steps, water and sleep. Cardio burn is estimated for you.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={SYSTEM.quickAdd} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M13 2L3 14h9l-1 8 10-12h-9z" color="var(--ice)" />
              <h3 className="h3 disp">Quick Add</h3>
              <p>Describe your day in plain words — “squats 5×5 at 100, 30 min bike, chicken and rice” — and it becomes a saved log.</p>
            </div>
          </article>

          <article className="f-card f-photo-card" data-reveal>
            <img src={PHOTOS.barbellFloor} alt="" loading="lazy" data-speed="0.6" />
            <div className="f-overlay">
              <FIcon d="M3 3v18h18M7 15l4-4 3 3 5-6" color="var(--pulse)" />
              <h3 className="h3 disp">Progress &amp; records</h3>
              <p>Charts for every lift, bodyweight and weekly score, with personal records flagged the moment you hit them.</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
