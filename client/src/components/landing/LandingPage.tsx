"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect } from "react";
import { useForceDarkTheme } from "@/components/ThemeToggle";
import { Cursor, LandingFooter, Nav } from "./chrome";
import { CTA, Coach, Disciplines, FAQ, Features, Film, GoalPicker, Hero, HowItWorks, Integrations, Pricing, Story } from "./sections";
import { PHOTOS } from "./photos";
import { useLandingMotion } from "./useLandingMotion";
import { useScrollAnimations } from "./useScrollAnimations";
import "./landing.css";
import "./l2.css";
import "./l3.css";
import "./home.css";
import "./theme";

/*
  The public home page. Two layers of styling and motion work together:
    .lp  (landing.css + useLandingMotion)     — page shell, smooth scroll, the system cards, phone story,
                                                goal picker, film, CTA, footer
    .l2  (l2.css / l3.css + useScrollAnimations) — the block sections: hero, how it works, coach,
                                                disciplines, pricing, integrations + FAQ
  The page is dark-only (the photo-led sections are built for it).
*/
export default function LandingPage() {
  // No preloader: the hero has its own entrance, so page motion starts straight away.
  const [, setReady] = useLandingMotion();
  useEffect(() => setReady(true), [setReady]);
  useScrollAnimations();
  useForceDarkTheme();

  return (
    <div className="lp home">
      <Cursor />
      <Nav />
      <main>
        <div className="l2 l3">
          <Hero />
          <HowItWorks />
        </div>
        <Features />
        <Story />
        <GoalPicker />
        <div className="l2 l3">
          <Coach />
          <Disciplines />
        </div>
        {/* Pricing sits on the gym photo, held in place while the section scrolls over it */}
        <div className="l2 l3 home-photo">
          <div className="home-photo-bg" aria-hidden="true">
            <img src={PHOTOS.gymInterior} alt="" loading="lazy" />
          </div>
          <Pricing />
        </div>
        <div className="l2 l3">
          <Integrations />
        </div>
        <Film />
        <div className="l2 l3">
          <FAQ />
        </div>
        <CTA />
      </main>
      <LandingFooter />
    </div>
  );
}
