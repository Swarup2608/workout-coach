"use client";

import { useEffect, useState } from "react";
import { scrollToHash } from "../lib";

/* Same 24×24 stroke icon style as the app's phone tab bar (components/MobileTabs.tsx) */
const ITEMS = [
  { id: "top", label: "Home", d: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { id: "how", label: "How", d: "M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3" },
  { id: "features", label: "Features", d: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" },
  { id: "coach", label: "Coach", d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "pricing", label: "Pricing", d: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" },
];

/**
 * Bottom section bar on phones and tablets (where the top nav's links are hidden).
 * On the home page it jumps between sections and marks the one in view; elsewhere (`onHome={false}`)
 * the links go to the home page's sections.
 */
export function MobileBar({ onHome = true }: { onHome?: boolean }) {
  const [active, setActive] = useState(onHome ? "top" : "");

  // Mark the section nearest the middle of the screen
  useEffect(() => {
    if (!onHome) return;
    const sections = ITEMS.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [onHome]);

  return (
    <nav className="mobile-bar" aria-label="Sections">
      <ul>
        {ITEMS.map((i) => {
          const href = onHome ? `#${i.id}` : `/#${i.id}`;
          const on = active === i.id;
          return (
            <li key={i.id}>
              <a href={href} aria-current={on ? "location" : undefined} className={on ? "is-on" : undefined} onClick={(e) => scrollToHash(e, href)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={i.d} />
                </svg>
                {i.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
