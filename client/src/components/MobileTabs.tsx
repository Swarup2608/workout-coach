"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { NO_DOCK } from "@/components/coach/CoachDock";

const TABS = [
  { href: "/dashboard", label: "Today", d: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/plan", label: "Plan", d: "M4 5h16v16H4zM4 9h16M9 3v4M15 3v4" },
  { href: "/nutrition", label: "Food", d: "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" },
  { href: "/progress", label: "Progress", d: "M4 19h16M6 16l4-5 3 3 5-7" },
  { href: "/exercises", label: "Exercises", d: "M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12" },
  { href: "/log", label: "Log", d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
];

/** Bottom tab bar on phones. Profile lives in the avatar menu (top right), not here. */
export function MobileTabs() {
  const { user } = useAuth();
  const path = usePathname();
  if (!user || NO_DOCK.filter((p) => p !== "/chat").some((p) => path.startsWith(p)) || path.startsWith("/workout/live")) return null;
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto flex h-16 max-w-lg">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] ${active ? "text-volt-bright" : "text-ink-400"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={t.d} />
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
