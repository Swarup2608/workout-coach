"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Cursor, LandingFooter, LandingNav, Preloader } from "./chrome";
import { CTA, FAQ, Features, Film, Gallery, GoalPicker, Hero, Marquee, Pricing, Story } from "./sections";
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

      // Capabilities strip slides in
      gsap.from(".marquee", { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".marquee", start: "top 95%" } });

      // Features: icons pop, meters fill
      gsap.utils.toArray<HTMLElement>(".bento .f-card").forEach((el) => {
        gsap.from(el.querySelector(".f-icon"), { scale: 0, rotate: -45, duration: 0.9, ease: "back.out(1.8)", scrollTrigger: { trigger: el, start: "top 80%" } });
        const meter = el.querySelector(".meter i");
        if (meter) gsap.from(meter, { width: "0%", duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 75%" } });
      });

      // Goal picker photo wipes in; day rows cascade
      gsap.fromTo(".gp-bg", { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".gp", start: "top bottom", end: "center center", scrub: true } });
      gsap.from(".gp-day", { x: 40, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, scrollTrigger: { trigger: ".gp-days", start: "top 85%" } });

      // Pricing: card contents cascade
      gsap.utils.toArray<HTMLElement>(".price-card").forEach((el) => {
        gsap.from(el.querySelectorAll("h3, .price, li"), { y: 24, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.06, scrollTrigger: { trigger: el, start: "top 80%" } });
      });

      // FAQ plus icons spin in
      gsap.from(".faq-plus", { rotate: -180, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.08, scrollTrigger: { trigger: ".faq", start: "top 85%" } });

      // CTA background eases from a zoom, mark rotates in
      gsap.fromTo(".cta-bg", { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".cta", start: "top bottom", end: "center center", scrub: true } });
      gsap.from(".cta-mark", { rotate: -90, scale: 0.6, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".cta", start: "top 70%" } });

      // Footer wordmark rises as the page ends
      gsap.fromTo(".footer-giant", { yPercent: 40, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true } });
      gsap.from(".footer-inner > *", { y: 20, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: ".footer", start: "top 95%" } });

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
        <Features />
        <Film />
        <Gallery />
        <Story />
        <GoalPicker />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <LandingFooter />
    </div>
  );
}
