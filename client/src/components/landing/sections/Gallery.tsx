"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { DISCIPLINES as CARDS } from "../disciplines";

export function Gallery() {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      "(min-width: 900px) and (prefers-reduced-motion: no-preference)",
      () => {
        const distance = () => track.current!.scrollWidth - window.innerWidth + 48;
        const tween = gsap.to(track.current, {
          x: () => -distance(),
          ease: "none",
          scrollTrigger: { trigger: section.current, start: "top top", end: () => "+=" + distance(), pin: true, scrub: 1, invalidateOnRefresh: true },
        });
        // Each photo drifts inside its frame as the row slides
        gsap.utils.toArray<HTMLElement>(".g-card img").forEach((img) => {
          gsap.fromTo(
            img,
            { xPercent: -8 },
            { xPercent: 8, ease: "none", scrollTrigger: { trigger: img.parentElement, containerAnimation: tween, start: "left right", end: "right left", scrub: true } }
          );
        });
      },
      section
    );
    return () => mm.revert();
  }, []);

  return (
    <section className="gallery" ref={section} aria-label="Training disciplines">
      <div className="gallery-head container">
        <div className="eyebrow mono">ONE COACH · EVERY DISCIPLINE</div>
      </div>
      <div className="g-track" ref={track}>
        <div className="g-intro">
          <h2 className="h2 disp">
            Built for the way <span className="accent">you</span> train.
          </h2>
          <p className="lead">Strength, cardio, mobility or sport — plan it your way and StarkFitIQ tracks and scores it.</p>
          <Link className="g-all mono" href="/disciplines">
            READ ALL GUIDES →
          </Link>
        </div>
        {CARDS.map((c, i) => (
          <Link className="g-card" key={c.slug} href={`/disciplines/${c.slug}`} data-cursor="READ">
            <img src={c.img} alt="" loading="lazy" />
            <div className="g-shade" />
            <div className="g-meta">
              <span className="g-tag mono">
                {String(i + 1).padStart(2, "0")} · {c.tag}
              </span>
              <h3 className="disp">{c.title}</h3>
              <span className="g-note">{c.note}</span>
              <span className="g-read mono">READ · {c.readMins} MIN →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
