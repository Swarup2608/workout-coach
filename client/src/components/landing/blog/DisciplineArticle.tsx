"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LandingFooter, LandingNav } from "../chrome";
import { DISCIPLINES, type Discipline } from "../disciplines";
import { Arrow, useStartHref } from "../shared";
import "../landing.css";
import "./blog.css";

/** A single discipline guide, read like a blog post. Public: no login needed. */
export function DisciplineArticle({ d }: { d: Discipline }) {
  const start = useStartHref();
  const i = DISCIPLINES.findIndex((x) => x.slug === d.slug);
  const next = DISCIPLINES[(i + 1) % DISCIPLINES.length];
  const others = DISCIPLINES.filter((x) => x.slug !== d.slug).slice(0, 3);

  return (
    <div className="lp">
      <LandingNav />
      <main>
        <header className="post-hero">
          <img className="post-hero-img" src={d.img} alt="" />
          <div className="post-hero-shade" aria-hidden="true" />
          <div className="container post-hero-inner">
            <nav className="post-crumbs mono" aria-label="Breadcrumb">
              <Link href="/">HOME</Link> / <Link href="/disciplines">GUIDES</Link> / <span>{d.tag}</span>
            </nav>
            <div className="eyebrow mono">
              {String(i + 1).padStart(2, "0")} · {d.tag} · {d.readMins} MIN READ
            </div>
            <h1 className="post-title disp">{d.title}</h1>
            <p className="post-excerpt">{d.excerpt}</p>
          </div>
        </header>

        <div className="container post-layout">
          <article className="post-body">
            {d.body.map((s) => (
              <section key={s.heading}>
                <h2 className="disp">{s.heading}</h2>
                {s.paragraphs.map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
              </section>
            ))}
          </article>

          <aside className="post-aside">
            <div className="post-tracks">
              <div className="mono post-aside-k">HOW STARKFITIQ TRACKS IT</div>
              <ul>
                {d.tracks.map((t) => (
                  <li key={t}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
              <Link className="btn btn-accent" href={start}>
                Start free
                <Arrow />
              </Link>
            </div>
          </aside>
        </div>

        <section className="post-next container">
          <Link className="post-next-card" href={`/disciplines/${next.slug}`}>
            <img src={next.img} alt="" loading="lazy" />
            <div className="post-next-shade" aria-hidden="true" />
            <div className="post-next-meta">
              <span className="mono">NEXT GUIDE · {next.tag}</span>
              <h2 className="disp">{next.title}</h2>
            </div>
          </Link>
        </section>

        <section className="container post-more">
          <div className="mono post-aside-k">MORE GUIDES</div>
          <div className="post-grid">
            {others.map((o) => (
              <PostCard key={o.slug} d={o} />
            ))}
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

/** Blog-style card used on the index and under each article. */
export function PostCard({ d }: { d: Discipline }) {
  return (
    <Link className="post-card" href={`/disciplines/${d.slug}`}>
      <div className="post-card-img">
        <img src={d.img} alt="" loading="lazy" />
      </div>
      <div className="post-card-body">
        <span className="mono post-card-tag">
          {d.tag} · {d.readMins} MIN
        </span>
        <h3 className="disp">{d.title}</h3>
        <p>{d.excerpt}</p>
        <span className="post-card-more mono">READ GUIDE →</span>
      </div>
    </Link>
  );
}
