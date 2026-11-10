"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ApiStatus } from "@workout/shared";
import { api } from "@/lib/api";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/log", label: "Log" },
  { href: "/history", label: "History" },
  { href: "/plan", label: "Plan" },
  { href: "/chat", label: "Coach" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const path = usePathname();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setDown(true));
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="h-display text-xl">
          Rep<span className="text-volt">Score</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-ink-700 text-white" : "text-ink-400 hover:text-white"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span
          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
            down ? "border-bad/50 text-bad" : status?.claudeConnected ? "border-good/40 text-good" : "border-warn/40 text-warn"
          }`}
          title={status?.model}
        >
          <span className={`h-2 w-2 rounded-full ${down ? "bg-bad" : status?.claudeConnected ? "bg-good" : "bg-warn"}`} />
          {down ? "API offline" : status ? (status.claudeConnected ? "Claude API connected" : "Project mode (no API)") : "…"}
        </span>
      </div>
    </header>
  );
}
