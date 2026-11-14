"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const KEY = "sfiq-theme";

function readSaved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** Light/dark switch. The choice is remembered; until then the OS setting is followed. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // Matches the server render; the real value is read after mount.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      if (!readSaved()) apply(e.matches ? "light" : "dark", false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function apply(next: Theme, persist = true) {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = next;
    setTheme(next);
    if (persist) {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage unavailable */
      }
    }
    window.setTimeout(() => root.classList.remove("theme-anim"), 500);
  }

  const isLight = theme === "light";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => apply(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      <span className={`tt-icon ${isLight ? "" : "on"}`} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </span>
      <span className={`tt-icon ${isLight ? "on" : ""}`} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
    </button>
  );
}
