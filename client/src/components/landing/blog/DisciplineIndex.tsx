"use client";

import { HOME_LINKS, LandingFooter, Nav } from "../chrome";
import { DISCIPLINES } from "../disciplines";
import { PostCard } from "./DisciplineArticle";
import "../landing.css";
import "./blog.css";
import "../theme";

/** All discipline guides as a blog index. Public: no login needed. */
export function DisciplineIndex() {
  return (
    <div className="lp">
      <Nav links={HOME_LINKS.map(([h, l]) => [`/${h}`, l])} />
      <main className="container post-index">
        <div className="eyebrow mono">ONE COACH · EVERY DISCIPLINE</div>
        <h1 className="h2 disp">
          Guides for the way <span className="accent">you</span> train.
        </h1>
        <p className="lead">Short reads on strength, technique, cardio, mobility, sport and consistency — and how StarkFitIQ plans, tracks and scores each one.</p>
        <div className="post-grid">
          {DISCIPLINES.map((d) => (
            <PostCard key={d.slug} d={d} />
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
