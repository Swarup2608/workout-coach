"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { scrollToHash } from "../lib";
import { useStartHref } from "../shared";
import { MobileBar } from "./MobileBar";
import "../l2.css";

/** Section links for the home page. Other pages pass `/#…` links so they navigate home first. */
export const HOME_LINKS: [string, string][] = [
  ["#how", "How it works"],
  ["#features", "Features"],
  ["#coach", "AI coach"],
  ["#disciplines", "Disciplines"],
  ["#pricing", "Pricing"],
];

/** Site nav: fixed over every public page (home and the discipline guides), plus the bottom bar on phones. */
export function Nav({ links = HOME_LINKS }: { links?: [string, string][] }) {
  const onHome = links === HOME_LINKS;
  const start = useStartHref();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="l2 site-nav">
      <header className={`l2-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="l2-wrap l2-nav-in">
          <Link className="l2-brand" href="/#top" onClick={(e) => scrollToHash(e, "#top")} aria-label="StarkFitIQ home">
            <Logo size={52} />
          </Link>
          <nav aria-label="Sections">
            <ul className="l2-nav-links">
              {links.map(([h, label]) => (
                <li key={h}>
                  <a href={h} onClick={(e) => scrollToHash(e, h)}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="l2-nav-cta">
            <Link className="l2-link" href="/login">
              Log in
            </Link>
            <Link className="l2-btn l2-btn-primary l2-btn-sm" href={start}>
              Start free
            </Link>
          </div>
        </div>
      </header>
      <MobileBar onHome={onHome} />
    </div>
  );
}
