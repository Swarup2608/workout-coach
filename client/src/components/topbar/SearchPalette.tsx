"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseInfo, WorkoutSession } from "@/lib/domain";
import { api } from "@/lib/api";
import { Icon, type IconName } from "@/components/Icons";

type Hit = { kind: "Page" | "Exercise" | "Workout" | "Log"; label: string; sub?: string; href: string; icon: IconName };

const PAGES: Hit[] = [
  { kind: "Page", label: "Today", href: "/dashboard", icon: "home" },
  { kind: "Page", label: "Plan", href: "/plan", icon: "calendar" },
  { kind: "Page", label: "Progress", href: "/progress", icon: "chart" },
  { kind: "Page", label: "Exercises", href: "/exercises", icon: "dumbbell" },
  { kind: "Page", label: "Workout Log", href: "/log", icon: "list" },
  { kind: "Page", label: "History", href: "/history", icon: "clock" },
  { kind: "Page", label: "Daily check-in", href: "/checkin", icon: "smile" },
  { kind: "Page", label: "AI Coach", href: "/chat", icon: "sparkles" },
  { kind: "Page", label: "Profile", href: "/profile", icon: "user" },
  { kind: "Page", label: "Settings", href: "/profile#account", icon: "settings" },
];

const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Search button for the top bar + its ⌘K / Ctrl+K palette (pages, exercises, workouts, logged days). */
export function Search() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search workouts, exercises and logs"
        className="flex h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-400 hover:border-ink-500 md:w-56"
      >
        <Icon name="search" size={17} />
        <span className="hidden flex-1 truncate whitespace-nowrap text-left md:inline">Search…</span>
        <kbd className="hidden rounded-md border border-ink-700 px-1.5 py-0.5 text-[11px] md:inline">⌘K</kbd>
      </button>
      {open && <Palette onClose={() => setOpen(false)} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [exercises, setExercises] = useState<ExerciseInfo[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    ref.current?.showModal();
    api.exercises().then(setExercises).catch(() => {});
    api.sessions().then(setSessions).catch(() => {});
  }, []);

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    const match = (...t: (string | undefined)[]) => !s || t.some((x) => x?.toLowerCase().includes(s));
    const done = sessions.filter((x) => x.exercises.some((e) => e.sets.some((st) => st.done)) || (x.durationMin ?? 0) > 0).sort((a, b) => b.date.localeCompare(a.date));
    const workouts: Hit[] = done.map((x) => ({ kind: "Workout", label: x.title ?? `${x.day} workout`, sub: fmt(x.date), href: `/workout/summary/${x.id}`, icon: "dumbbell" }));
    const logs: Hit[] = [...new Set(done.map((x) => x.date))].map((d) => ({ kind: "Log", label: `Log for ${fmt(d)}`, sub: d, href: `/log?date=${d}`, icon: "list" }));
    const ex: Hit[] = exercises.map((e) => ({ kind: "Exercise", label: e.name, sub: e.muscle, href: `/exercises/${e.slug}`, icon: "biceps" }));
    const groups: Hit[][] = [
      PAGES.filter((h) => match(h.label)),
      ex.filter((h) => match(h.label, h.sub)).slice(0, s ? 8 : 4),
      workouts.filter((h) => match(h.label, h.sub, h.href)).slice(0, s ? 6 : 3),
      logs.filter((h) => match(h.label, h.sub)).slice(0, s ? 5 : 2),
    ];
    return groups.flat();
  }, [q, exercises, sessions]);

  useEffect(() => setSel(0), [q]);

  const go = (h: Hit) => {
    onClose();
    router.push(h.href);
  };

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-ink-600 bg-ink-900 p-0 text-ink-200 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 border-b border-ink-700 px-4">
        <Icon name="search" size={18} className="text-ink-400" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((i) => Math.min(hits.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter" && hits[sel]) {
              e.preventDefault();
              go(hits[sel]);
            }
          }}
          placeholder="Search workouts, exercises, logs"
          aria-label="Search query"
          className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-ink-400"
        />
        <kbd className="rounded-md border border-ink-700 px-1.5 py-0.5 text-[11px] text-ink-400">Esc</kbd>
      </div>
      <ul role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
        {hits.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-400">Nothing matches “{q}”.</li>}
        {hits.map((h, i) => (
          <li key={h.kind + h.href + h.label} role="option" aria-selected={i === sel}>
            <button
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => go(h)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? "bg-ink-800 text-fg" : ""}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-800 text-volt-bright">
                <Icon name={h.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{h.label}</span>
                {h.sub && <span className="block truncate text-xs capitalize text-ink-400">{h.sub}</span>}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-ink-400">{h.kind}</span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
