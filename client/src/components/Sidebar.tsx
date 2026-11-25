"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Icon, type IconName } from "@/components/Icons";
import { Logo, LogoMark } from "@/components/Logo";

/** localStorage key; the root layout's head script reads it so the rail paints collapsed with no flash. */
export const SIDEBAR_KEY = "sfiq-sidebar";

type Item = { href: string; label: string; icon: IconName; badge?: string; match?: (path: string) => boolean };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/dashboard", label: "Today", icon: "home" },
      { href: "/plan", label: "Plan", icon: "calendar" },
      { href: "/nutrition", label: "Nutrition", icon: "utensils" },
      { href: "/progress", label: "Progress", icon: "chart" },
      { href: "/exercises", label: "Exercises", icon: "dumbbell" },
      { href: "/log", label: "Workout Log", icon: "list" },
    ],
  },
  {
    title: "Intelligence",
    items: [{ href: "/chat", label: "AI Coach", icon: "sparkles", badge: "AI" }],
  },
  {
    title: "Personal",
    items: [
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/profile#account", label: "Settings", icon: "settings", match: () => false },
    ],
  },
];

/** Desktop left rail (lg+), fixed. Collapses to icons only; Ctrl/Cmd+B toggles it. */
export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Pick up what the head script already applied.
  useEffect(() => setCollapsed(document.documentElement.dataset.sidebar === "collapsed"), []);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.documentElement.dataset.sidebar = next ? "collapsed" : "open";
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open");
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b" && !(e.target as HTMLElement)?.closest?.("input, textarea, [contenteditable]")) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  if (!user) return null;

  return (
    <aside
      aria-label="Sidebar"
      className="fixed inset-y-0 left-0 z-30 hidden flex-col overflow-y-auto overflow-x-hidden border-r border-ink-700 bg-ink-950 py-5 transition-[width] duration-200 ease-out lg:flex"
      style={{ width: "var(--sidebar-w)" }}
    >
      <div className={`mb-6 flex items-center ${collapsed ? "flex-col gap-3 px-2" : "justify-between gap-2 px-4"}`}>
        <Link href="/dashboard" aria-label="StarkFitIQ dashboard" className={collapsed ? "" : "px-2"}>
          {collapsed ? <LogoMark size={30} /> : <Logo size={48} />}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl/Cmd+B)`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-900 hover:text-fg"
        >
          <Icon name={collapsed ? "panelOpen" : "panelClose"} size={18} />
        </button>
      </div>

      <nav className={`flex flex-1 flex-col gap-5 ${collapsed ? "px-2" : "px-4"}`}>
        {GROUPS.map((g) => (
          <div key={g.title}>
            {collapsed ? (
              <div className="mx-2 mb-2 border-t border-ink-700" aria-hidden />
            ) : (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{g.title}</p>
            )}
            <ul className="flex flex-col gap-1">
              {g.items.map((it) => {
                const active = it.match ? it.match(path) : path.startsWith(it.href);
                return (
                  <li key={it.label}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={collapsed ? it.label : undefined}
                      title={collapsed ? it.label : undefined}
                      className={`flex items-center rounded-xl text-sm font-medium transition ${collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2.5"} ${
                        active ? "bg-volt text-on-accent" : "text-ink-400 hover:bg-ink-900 hover:text-fg"
                      }`}
                    >
                      <Icon name={it.icon} />
                      {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                      {!collapsed && it.badge && (
                        <span className={`t-badge rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20" : "bg-volt/15 text-volt-bright"}`}>{it.badge}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={collapsed ? "px-2" : "px-4"}>
        {collapsed ? (
          <Link href="/chat" aria-label="Open coach" title="StarkFitIQ Coach" className="flex h-10 items-center justify-center rounded-xl border border-ink-700 text-volt-bright hover:border-volt-bright/60">
            <Icon name="sparkles" size={18} />
          </Link>
        ) : (
          <Link href="/chat" className="block rounded-xl border border-ink-700 p-3 hover:border-volt-bright/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Icon name="sparkles" size={16} className="text-volt-bright" /> StarkFitIQ Coach
            </p>
            <p className="mt-0.5 text-xs text-ink-400">Your personal fitness intelligence.</p>
            <p className="mt-2 text-xs font-medium text-volt-bright">Open coach →</p>
          </Link>
        )}
      </div>
    </aside>
  );
}
