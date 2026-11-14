"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cursor, LandingFooter, LandingNav, Preloader } from "./chrome";
import { CTA, FAQ, Features, Film, Gallery, GoalPicker, Hero, HowItWorks, Marquee, Pricing, Story } from "./sections";
import "./landing.css";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const [ready, setReady] = useState(false);

  // Smooth scroll (Lenis) driven by GSAP's ticker so ScrollTrigger stays in sync
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  // Lock scrolling while the preloader runs
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("is-loading", !ready);
    if (ready) {
      window.__lenis?.start();
      ScrollTrigger.refresh();
    } else {
      window.__lenis?.stop();
    }
    return () => html.classList.remove("is-loading");
  }, [ready]);

  // Site-wide reveal + parallax behaviours, set up once content is visible
  useEffect(() => {
    if (!ready) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.set("[data-reveal]", { opacity: 0, y: 56 });
      ScrollTrigger.batch("[data-reveal]", {
        start: "top 88%",
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out", stagger: 0.09, overwrite: true }),
      });

      gsap.utils.toArray<HTMLElement>("[data-speed]").forEach((el) => {
        const speed = parseFloat(el.dataset.speed || "0");
        gsap.fromTo(
          el,
          { yPercent: -speed * 10 },
          { yPercent: speed * 10, ease: "none", scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true } }
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-split]").forEach((el) => {
        gsap.from(el.querySelectorAll(".word > span"), {
          yPercent: 110,
          duration: 1.1,
          ease: "expo.out",
          stagger: 0.05,
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });
    });
    return () => mm.revert();
  }, [ready]);

  return (
    <div className="lp">
      <Preloader onDone={() => setReady(true)} />
      <Cursor />
      <LandingNav />
      <main>
        <Hero ready={ready} />
        <Marquee />
        <HowItWorks />
        <Gallery />
        <Features />
        <Story />
        <GoalPicker />
        <Film />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <LandingFooter />
    </div>
  );
}
