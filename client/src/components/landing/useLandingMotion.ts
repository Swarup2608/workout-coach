"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Page-level motion for the home page: Lenis smooth scroll and the reveal / parallax behaviours
 * of the .lp sections. Scroll stays paused and reveals wait until the page calls setReady(true).
 */
export function useLandingMotion() {
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

  // Hold smooth scroll until the page is ready
  useEffect(() => {
    if (ready) {
      window.__lenis?.start();
      ScrollTrigger.refresh();
    } else {
      window.__lenis?.stop();
    }
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

      // Features: icons pop, meters fill
      gsap.utils.toArray<HTMLElement>(".bento .f-card").forEach((el) => {
        gsap.from(el.querySelector(".f-icon"), { scale: 0, rotate: -45, duration: 0.9, ease: "back.out(1.8)", scrollTrigger: { trigger: el, start: "top 80%" } });
        const meter = el.querySelector(".meter i");
        if (meter) gsap.from(meter, { width: "0%", duration: 1.6, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 75%" } });
      });

      // Goal picker photo wipes in; day rows cascade
      if (document.querySelector(".gp")) gsap.fromTo(".gp-bg", { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".gp", start: "top bottom", end: "center center", scrub: true } });
      if (document.querySelector(".gp")) gsap.from(".gp-day", { x: 40, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.07, scrollTrigger: { trigger: ".gp-days", start: "top 85%" } });

      // CTA background eases from a zoom, mark rotates in
      gsap.fromTo(".cta-bg", { scale: 1.2 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".cta", start: "top bottom", end: "center center", scrub: true } });
      if (document.querySelector(".cta-mark")) gsap.from(".cta-mark", { rotate: -90, scale: 0.6, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".cta", start: "top 70%" } });

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

  return [ready, setReady] as const;
}
