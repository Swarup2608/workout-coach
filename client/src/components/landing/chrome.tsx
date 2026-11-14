"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useAuth } from "@/components/AuthProvider";
import { BrandImage, Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { scrollToHash, useMagnetic } from "./lib";

/* ------------------------------ Preloader ------------------------------- */

/** If the page, fonts and first hero clip are ready within this window, the loader is never shown. */
const LOADER_GRACE_MS = 400;
/** Never hold the page longer than this, even on a very slow connection. */
const LOADER_MAX_MS = 8000;

/**
 * Covers the page only while it is genuinely still loading. Waits on the window
 * load event, web fonts, and the first hero video being playable; the counter
 * tracks that real progress. On a fast or cached load it just fades away.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [gone, setGone] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      done.current();
      return;
    }

    const loaded = { page: false, fonts: false, video: false };
    const progress = { v: 0 };
    const setProgress = () => setCount(Math.round(progress.v));
    let shown = false;
    let finished = false;
    let exit: gsap.core.Timeline | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(graceTimer);
      clearTimeout(maxTimer);
      gsap.killTweensOf(progress);
      exit = gsap.timeline({
        onComplete: () => {
          setGone(true);
          done.current();
        },
      });
      if (shown) {
        exit
          .to(progress, { v: 100, duration: 0.4, ease: "power2.out", onUpdate: setProgress })
          .to(".pre-inner", { y: -40, opacity: 0, duration: 0.45, ease: "power2.in" }, "+=0.1")
          .to(root.current, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.15");
      } else {
        exit.to(root.current, { opacity: 0, duration: 0.35, ease: "power1.out" });
      }
    };

    const update = () => {
      if (finished) return;
      const parts = Object.values(loaded);
      if (parts.every(Boolean)) return finish();
      if (shown) {
        const target = (parts.filter(Boolean).length / parts.length) * 100;
        gsap.to(progress, { v: target, duration: 0.8, ease: "power2.out", overwrite: true, onUpdate: setProgress });
      }
    };
    const mark = (key: keyof typeof loaded) => () => {
      loaded[key] = true;
      update();
    };

    // Window load (images, scripts, styles)
    const onPage = mark("page");
    if (document.readyState === "complete") loaded.page = true;
    else window.addEventListener("load", onPage, { once: true });

    // Web fonts
    if (document.fonts) document.fonts.ready.then(mark("fonts"), mark("fonts"));
    else loaded.fonts = true;

    // First hero clip can start playing
    const video = document.querySelector<HTMLVideoElement>(".hero-media video");
    const onVideo = mark("video");
    if (!video || video.readyState >= 3) loaded.video = true;
    else {
      video.addEventListener("canplay", onVideo, { once: true });
      video.addEventListener("error", onVideo, { once: true });
    }

    // Still loading after the grace period: reveal the loader
    const graceTimer = setTimeout(() => {
      if (finished) return;
      shown = true;
      gsap.to(".pre-inner", { opacity: 1, duration: 0.3, ease: "power1.out" });
      gsap.fromTo(".pre-mark", { clipPath: "inset(100% 0 0 0)", scale: 0.85 }, { clipPath: "inset(0% 0 0 0)", scale: 1, duration: 1.2, ease: "power3.inOut" });
      update();
    }, LOADER_GRACE_MS);
    const maxTimer = setTimeout(finish, LOADER_MAX_MS);

    update();

    return () => {
      clearTimeout(graceTimer);
      clearTimeout(maxTimer);
      window.removeEventListener("load", onPage);
      video?.removeEventListener("canplay", onVideo);
      video?.removeEventListener("error", onVideo);
      gsap.killTweensOf(progress);
      gsap.killTweensOf(".pre-mark, .pre-inner");
      exit?.kill();
    };
  }, []);

  if (gone) return null;
  return (
    <div className="preloader" ref={root} aria-hidden="true">
      <div className="pre-inner">
        <div className="pre-mark">
          <BrandImage variant="mark" size={104} alt="" />
        </div>
        <div className="pre-count mono">{String(count).padStart(3, "0")}</div>
        <div className="pre-label mono">CALIBRATING YOUR COACH</div>
      </div>
    </div>
  );
}

/* ------------------------------- Cursor --------------------------------- */

/** An accent follower that grows over links, buttons and media (pointer devices only). */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) {
      el.style.display = "none";
      return;
    }
    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.("a, button, [data-cursor]") as HTMLElement | null;
      el.classList.toggle("is-hover", !!t);
      el.dataset.label = t?.dataset.cursor || "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, []);
  return <div className="cursor" ref={ref} aria-hidden="true" />;
}

/* --------------------------------- Nav ---------------------------------- */

const LINKS: [string, string][] = [
  ["#how", "How it works"],
  ["#features", "Features"],
  ["#plans", "Your plan"],
  ["#pricing", "Pricing"],
];

export function LandingNav() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const cta = useMagnetic(0.3);

  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setHidden(y > 400 && y > last);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (e: React.MouseEvent, hash: string) => {
    setOpen(false);
    scrollToHash(e, hash);
  };

  const ctaHref = user ? "/dashboard" : "/signup";
  const ctaLabel = user ? "Open dashboard" : "Get started";

  return (
    <header className={`nav ${scrolled ? "is-scrolled" : ""} ${hidden && !open ? "is-hidden" : ""} ${open ? "is-open" : ""}`}>
      <nav className="nav-inner" aria-label="Main">
        <a href="#top" className="nav-brand" onClick={(e) => go(e, "#top")} aria-label="StarkFitIQ home">
          <Logo size={34} />
        </a>
        <ul className="nav-links">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={(e) => go(e, href)}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
          <ThemeToggle />
          {!user && (
            <Link className="nav-login" href="/login">
              Log in
            </Link>
          )}
          <Link ref={cta} className="btn btn-accent nav-cta" href={ctaHref}>
            {ctaLabel}
          </Link>
          <button className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span />
            <span />
          </button>
        </div>
      </nav>
      <div className="nav-sheet">
        {LINKS.map(([href, label]) => (
          <a key={href} href={href} onClick={(e) => go(e, href)} className="disp">
            {label}
          </a>
        ))}
        {!user && (
          <Link className="btn btn-ghost" href="/login">
            Log in
          </Link>
        )}
        <Link className="btn btn-accent" href={ctaHref}>
          {ctaLabel}
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------- Footer -------------------------------- */

export function LandingFooter() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo size={28} />
          <span className="muted">© {new Date().getFullYear()} StarkFitIQ</span>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <a href="#top">Privacy</a>
          <a href="#top">Terms</a>
          <a href="#top">Contact</a>
          <Link href="/login">Log in</Link>
        </nav>
        <p className="credits muted">Photos: Unsplash</p>
      </div>
      <div className="footer-giant disp" aria-hidden="true">
        StarkFitIQ
      </div>
    </footer>
  );
}
