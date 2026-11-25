"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ApiStatus } from "@/lib/domain";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LivePill } from "@/components/workout/LivePill";
import { DateSelector } from "@/components/topbar/DateSelector";
import { Search } from "@/components/topbar/SearchPalette";
import { Notifications } from "@/components/topbar/Notifications";

/** Main sections, shown as a link row on tablets (md–lg), where there's no sidebar or bottom tabs. */
export const NAV_LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/progress", label: "Progress" },
  { href: "/exercises", label: "Exercises" },
  { href: "/log", label: "Workout Log" },
  { href: "/chat", label: "AI Coach" },
];

/** Signed-in top bar: a utility strip (date, search, alerts, AI status, theme, account), not page content. */
export function Nav() {
  const path = usePathname();
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [down, setDown] = useState(false);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    // 403 = email not verified yet (the verify screen is showing), not an outage.
    api.status().then(setStatus).catch((e) => setDown(!(e instanceof ApiError && e.status === 403)));
  }, [user, path]);

  useEffect(() => {
    const close = (e: MouseEvent) => menu.current && !menu.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user) {
    return (
      <header className="border-b border-ink-700 bg-ink-950/90">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Link href="/" aria-label="StarkFitIQ home">
            <Logo size={48} />
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>
    );
  }

  const ai = down
    ? { dot: "bg-bad", text: "API offline. The server isn't reachable." }
    : status?.aiConnected
      ? { dot: "bg-good", text: `AI online: ${status.label}` }
      : status
        ? { dot: "bg-warn", text: "AI offline: no AI key. Scoring still works; add a key in Settings." }
        : { dot: "bg-ink-500", text: "Checking AI status…" };

  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-3">
        <Link href="/dashboard" aria-label="StarkFitIQ dashboard" className="shrink-0 lg:hidden">
          <Logo size={44} />
        </Link>
        <div className="hidden sm:block">
          <DateSelector />
        </div>
        <div className="flex-1" />
        <Search />
        <LivePill />
        <Notifications aiConnected={down ? false : (status?.aiConnected ?? null)} />
        {/* AI status: a small indicator, not a pill */}
        <Link href="/profile#ai" className="group relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-ink-800" aria-label={ai.text} title={ai.text}>
          <Icon name="bot" size={18} className="text-ink-400 group-hover:text-fg" />
          <span className={`absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full ring-2 ring-ink-950 ${ai.dot}`} />
        </Link>
        <ThemeToggle />
        <div className="relative" ref={menu}>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-volt/20 text-sm font-semibold text-volt-bright hover:bg-volt/30"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Account menu"
          >
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </button>
          {open && (
            <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-xl">
              <div className="border-b border-ink-700 px-2 pb-2">
                <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                <p className="truncate text-xs text-ink-400">{user.email}</p>
              </div>
              <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800">
                <Icon name="user" size={16} /> Profile
              </Link>
              <Link role="menuitem" href="/profile#account" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800">
                <Icon name="settings" size={16} /> Settings
              </Link>
              <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-bad hover:bg-ink-800">
                <Icon name="logout" size={16} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
      <nav aria-label="Main" className="hidden gap-1 overflow-x-auto px-4 pb-2 md:flex lg:hidden">
        {NAV_LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-ink-700 text-fg" : "text-ink-400 hover:text-fg"}`}>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
