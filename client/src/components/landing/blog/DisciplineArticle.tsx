"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { HOME_LINKS, LandingFooter, Nav } from "../chrome";
import { DISCIPLINES, type Discipline } from "../disciplines";
import { Arrow, useStartHref } from "../shared";
import { vars } from "../lib";
import "../landing.css";
import "./blog.css";
import "../theme";

/** The home page's section links, made absolute so they work from a guide. */
const GUIDE_LINKS = HOME_LINKS.map(([h, l]) => [`/${h}`, l] as [string, string]);

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

/**
 * A single discipline guide, read like a blog post. Public: no login needed.
 * The guide's own photo carries the page: full-bleed hero, a blurred wash behind the article,
 * and the header of the "How StarkFitIQ tracks it" card.
 */
export function DisciplineArticle({ d }: { d: Discipline }) {
  const start = useStartHref();
  const i = DISCIPLINES.findIndex((x) => x.slug === d.slug);
  const next = DISCIPLINES[(i + 1) % DISCIPLINES.length];
  const others = DISCIPLINES.filter((x) => x.slug !== d.slug).slice(0, 3);
  const n = (k: number) => String(k).padStart(2, "0");

  return (
    <div className="lp post" style={vars({ "--post-img": `url("${d.img}")`, "--post-focus": d.focus ?? "center 45%" })}>
      {/* Reading progress, driven by the scroll timeline (hidden where unsupported) */}
      <div className="post-progress" aria-hidden="true" />
      <Nav links={GUIDE_LINKS} />
      <main>
        <header className="post-hero">
          <div className="post-hero-media">
            <img className="post-hero-img" src={d.img} alt="" fetchPriority="high" />
          </div>
          <div className="post-hero-shade" aria-hidden="true" />
          <div className="container post-hero-inner">
            <nav className="post-crumbs" aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <span aria-hidden="true">/</span>
              <Link href="/disciplines">Guides</Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{d.tag.toLowerCase()}</span>
            </nav>
            <div className="post-meta">
              <span className="post-chip">{d.tag}</span>
              <span>
                Guide {n(i + 1)} of {n(DISCIPLINES.length)}
              </span>
              <span className="post-dot" aria-hidden="true" />
              <span>{d.readMins} min read</span>
            </div>
            <h1 className="post-title">{d.title}</h1>
            <p className="post-excerpt">{d.excerpt}</p>
          </div>
        </header>

        <div className="post-main">
          {/* The hero photo, blurred and darkened, tints the reading area for this discipline */}
          <div className="post-ambient" aria-hidden="true" />
          <div className="container post-layout">
            <article className="post-body">
              {d.body.map((s, k) => (
                <section key={s.heading} className="post-sec">
                  <div className="post-sec-n" aria-hidden="true">
                    {n(k + 1)}
                  </div>
                  <h2>{s.heading}</h2>
                  {s.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </section>
              ))}
            </article>

            <aside className="post-aside">
              <div className="post-tracks">
                <div className="post-tracks-img" aria-hidden="true">
                  <img src={d.img} alt="" loading="lazy" />
                  <span>{d.tag}</span>
                </div>
                <div className="post-tracks-body">
                  <div className="post-aside-k">How StarkFitIQ tracks it</div>
                  <ul>
                    {d.tracks.map((t) => (
                      <li key={t}>
                        <span className="post-tick">
                          <Check />
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <Link className="btn btn-accent" href={start}>
                    Start free
                    <Arrow />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <section className="post-next container">
          <Link className="post-next-card" href={`/disciplines/${next.slug}`} style={vars({ "--post-focus": next.focus ?? "center 45%" })}>
            <img src={next.img} alt="" loading="lazy" />
            <div className="post-next-shade" aria-hidden="true" />
            <div className="post-next-meta">
              <span className="post-aside-k">Next guide · {next.tag.toLowerCase()}</span>
              <h2>{next.title}</h2>
              <span className="post-next-go">
                Read guide <Arrow />
              </span>
            </div>
          </Link>
        </section>

        <section className="container post-more">
          <div className="post-aside-k">More guides</div>
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
        <img src={d.img} alt="" loading="lazy" style={{ objectPosition: d.focus ?? "center 45%" }} />
      </div>
      <div className="post-card-body">
        <span className="post-card-tag">
          {d.tag} · {d.readMins} min
        </span>
        <h3>{d.title}</h3>
        <p>{d.excerpt}</p>
        <span className="post-card-more">
          Read guide <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}
