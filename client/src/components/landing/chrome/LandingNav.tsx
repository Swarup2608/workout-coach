"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { useForceDarkTheme } from "@/components/ThemeToggle";
import { scrollToHash, useMagnetic } from "../lib";

const LINKS: [string, string][] = [
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
  // Landing + blog pages are dark-only.
  useForceDarkTheme();

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
        <a href="/" className="nav-brand" onClick={(e) => go(e, "#top")} aria-label="StarkFitIQ home">
          <Logo size={34} />
        </a>
        <ul className="nav-links">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={`/${href}`} onClick={(e) => go(e, href)}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="nav-actions">
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
          <a key={href} href={`/${href}`} onClick={(e) => go(e, href)} className="disp">
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
