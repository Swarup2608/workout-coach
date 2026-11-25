"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PHOTOS } from "../photos";
import { Arrow, useStartHref } from "../shared";

/** Closing call to action on the dark gym background. */
export function CTA() {
  const start = useStartHref();
  return (
    <section className="cta home-cta">
      <div className="cta-bg">
        <img src={PHOTOS.gymInterior} alt="" loading="lazy" data-speed="1.2" />
      </div>
      <div className="cta-shade" aria-hidden="true" />
      <div className="container cta-inner">
        <div data-reveal>
          <LogoMark size={80} className="cta-mark" />
        </div>
        <h2 className="cta-title disp home-cta-title" data-reveal>
          Your next PR starts with <span className="accent">this week’s plan.</span>
        </h2>
        <p className="lead" data-reveal>
          Set it up in a few minutes. Your first weekly score lands at the end of the week.
        </p>
        <div className="cta-form" data-reveal>
          <Link className="btn btn-accent btn-lg" href={start}>
            Start free
            <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
