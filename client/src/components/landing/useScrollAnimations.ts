"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/*
  Scroll choreography for the home page's block (.l2) sections (ui-ux-pro-max "Standard" motion tier).
  - Reveals: 0.5–0.9s, expo/back easing, 16–32px offsets, small staggers.
  - Scrubbed parallax only on decorative layers (video frame, floating cards, screenshots), desktop only.
  - No pinning, no scroll-jacking.
  - Everything sits inside matchMedia("prefers-reduced-motion: no-preference"): with reduced motion,
    or without JS, the page renders in its final, readable state.
*/
export function useScrollAnimations() {
  useEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      { motion: "(prefers-reduced-motion: no-preference)", desktop: "(min-width: 1025px)" },
      (ctx) => {
        const { motion, desktop } = ctx.conditions as { motion: boolean; desktop: boolean };
        if (!motion) return;
        // Only some block sections exist on the page, so section-specific tweens check first.
        const has = (sel: string) => !!document.querySelector(sel);

        if (has(".l2-hero")) {
        /* Hero: entrance on load */
        gsap
          .timeline({ defaults: { ease: "expo.out" } })
          .from(".l2-line > span", { yPercent: 110, duration: 0.9, stagger: 0.09 }, 0.1)
          // "Score it." highlight wipes in left → right once its line has landed
          .fromTo(".l2-mark", { "--fill": 0 }, { "--fill": 1, duration: 0.8, ease: "expo.inOut" }, 0.6)
          .from(".l2-hero-copy .l2-lead, .l2-hero-copy .l2-actions, .l2-hero-copy .l2-fine", { y: 20, opacity: 0, duration: 0.7, stagger: 0.08 }, 0.45)
          .from(".l2-reel", { scale: 0.94, opacity: 0, duration: 1.1 }, 0.2)
          .from(".l2-score-card", { y: 40, opacity: 0, duration: 0.8, ease: "back.out(1.6)" }, 0.7)
          .from(".l2-tip-card", { y: -30, opacity: 0, duration: 0.8, ease: "back.out(1.6)" }, 0.85);

        /* Hero: scrubbed depth as you leave it (decorative layers only) */
        if (desktop) {
          gsap
            .timeline({ scrollTrigger: { trigger: ".l2-hero", start: "top top", end: "bottom top", scrub: 0.6 } })
            .to(".l2-reel", { scale: 0.9, yPercent: 6, ease: "none" }, 0)
            .to(".l2-score-card", { yPercent: -60, xPercent: -8, ease: "none" }, 0)
            .to(".l2-tip-card", { yPercent: 70, xPercent: 6, ease: "none" }, 0);
        }

        }

        /* Stat blocks rise, numbers count up */
        gsap.from(".l2-stats li", { y: 32, opacity: 0, duration: 0.6, ease: "back.out(1.4)", stagger: 0.07, scrollTrigger: { trigger: ".l2-stats", start: "top 90%" } });
        gsap.utils.toArray<HTMLElement>("[data-count]").forEach((el) => {
          const to = parseFloat(el.dataset.count || "0");
          const suffix = el.dataset.suffix || "";
          const n = { v: 0 };
          gsap.to(n, {
            v: to,
            duration: to > 20 ? 1.4 : 0.9,
            ease: "power2.out",
            onUpdate: () => (el.textContent = Math.round(n.v) + suffix),
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          });
        });

        /* Section headings wipe up; eyebrows and leads fade up */
        gsap.utils.toArray<HTMLElement>(".l2-section .l2-h2").forEach((el) => {
          gsap.from(el, { clipPath: "inset(0 0 100% 0)", y: 28, duration: 0.9, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
        });
        gsap.set("[data-r]", { opacity: 0, y: 20 });
        ScrollTrigger.batch("[data-r]", {
          start: "top 90%",
          onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", stagger: 0.06, overwrite: true }),
        });

        /* How it works: steps rise in sequence, number badges pop */
        gsap.from(".l2-step", { y: 48, opacity: 0, duration: 0.7, ease: "expo.out", stagger: 0.12, clearProps: "transform", scrollTrigger: { trigger: ".l2-steps", start: "top 82%" } });
        gsap.from(".l2-step-n", { scale: 0, rotate: -30, duration: 0.6, ease: "back.out(2)", stagger: 0.12, delay: 0.15, scrollTrigger: { trigger: ".l2-steps", start: "top 82%" } });

        /* Features: cards rise in a wave across the grid; screenshots drift inside their frames */
        if (has(".l2-bento")) gsap.from(".l2-card", {
          y: 40,
          opacity: 0,
          scale: 0.97,
          duration: 0.7,
          ease: "back.out(1.3)",
          stagger: { each: 0.08, grid: "auto", from: "start" },
          clearProps: "transform",
          scrollTrigger: { trigger: ".l2-bento", start: "top 82%" },
        });
        if (desktop) {
          gsap.utils.toArray<HTMLElement>(".l2-card-img img").forEach((img) => {
            gsap.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.12, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
          });
        }

        /* Weekly score: rows slide in, bars fill in order */
        gsap.from(".l2-meters li", { x: 32, opacity: 0, duration: 0.6, ease: "power3.out", stagger: 0.08, scrollTrigger: { trigger: ".l2-meters", start: "top 82%" } });
        gsap.from(".l2-meter i", { scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "expo.out", stagger: 0.08, delay: 0.2, scrollTrigger: { trigger: ".l2-meters", start: "top 82%" } });

        /* Goals: photo wipes open, sample-week rows cascade */
        gsap.from(".l2-goal-img", { clipPath: "inset(0 100% 0 0 round 24px)", duration: 1.1, ease: "expo.inOut", scrollTrigger: { trigger: ".l2-goal", start: "top 80%" } });
        gsap.from(".l2-week", { x: 40, opacity: 0, duration: 0.8, ease: "expo.out", scrollTrigger: { trigger: ".l2-goal", start: "top 80%" } });
        gsap.from(".l2-week li", { x: 24, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.05, delay: 0.25, scrollTrigger: { trigger: ".l2-goal", start: "top 80%" } });

        /* Pricing: cards rise, featured card settles from a tilt */
        gsap.from(".l2-price", { y: 48, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".l2-prices", start: "top 82%" } });
        gsap.from(".l2-price.is-featured", { rotate: 3, duration: 1, ease: "back.out(1.8)", delay: 0.12, scrollTrigger: { trigger: ".l2-prices", start: "top 82%" } });
        gsap.from(".l2-price li", { x: -12, opacity: 0, duration: 0.4, ease: "power2.out", stagger: 0.04, delay: 0.3, scrollTrigger: { trigger: ".l2-prices", start: "top 82%" } });

        /* CTA: block grows to full size as it arrives, stripes slide with scroll */
        if (has(".l2-cta")) gsap.fromTo(".l2-cta", { scale: 0.9, opacity: 0.4 }, { scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: ".l2-cta", start: "top bottom", end: "top 55%", scrub: 0.5 } });
        if (has(".l2-cta")) gsap.fromTo(".l2-cta", { backgroundPosition: "0px 0px" }, { backgroundPosition: "220px 0px", ease: "none", scrollTrigger: { trigger: ".l2-cta", start: "top bottom", end: "bottom top", scrub: true } });
      }
    );

    // Fonts and images change layout height; recalculate trigger positions once they settle.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  }, []);
}
