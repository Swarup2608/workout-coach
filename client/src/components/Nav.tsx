"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ApiStatus } from "@/lib/domain";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/log", label: "Log" },
  { href: "/history", label: "History" },
  { href: "/plan", label: "Plan" },
  { href: "/chat", label: "Coach" },
  { href: "/profile", label: "Profile" },
];

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
            <Logo size={26} />
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/dashboard" aria-label="StarkFitIQ dashboard">
          <Logo size={26} />
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {links.map((l) => {
            const active = path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-ink-700 text-fg" : "text-ink-400 hover:text-fg"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/profile#ai"
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            down ? "border-bad/50 text-bad" : status?.aiConnected ? "border-good/40 text-good" : "border-warn/40 text-warn"
          }`}
          title={status?.label ?? "Add your AI provider key in Profile"}
        >
          <span className={`h-2 w-2 rounded-full ${down ? "bg-bad" : status?.aiConnected ? "bg-good" : "bg-warn"}`} />
          {down ? "API offline" : status ? (status.aiConnected ? status.label : "No AI key (offline mode)") : "…"}
        </Link>
        <ThemeToggle />
        <div className="relative" ref={menu}>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full bg-volt/20 text-sm font-semibold text-volt-bright hover:bg-volt/30"
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
              <Link role="menuitem" href="/profile#account" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-2 py-1.5 text-sm hover:bg-ink-800">
                Account & security
              </Link>
              <button role="menuitem" onClick={logout} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm text-bad hover:bg-ink-800">
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
