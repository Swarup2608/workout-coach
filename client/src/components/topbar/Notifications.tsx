"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TodayData } from "@/lib/domain";
import { api, today } from "@/lib/api";
import { DATA_CHANGED } from "@/components/coach/actions";
import { Icon, type IconName } from "@/components/Icons";

type Note = { id: string; icon: IconName; title: string; body: string; href: string; tone: "action" | "info" };

/** Reminders and training alerts, worked out from today's data (no server-side push yet). */
function buildNotes(t: TodayData | null, aiConnected: boolean | null): Note[] {
  const notes: Note[] = [];
  if (t?.live) notes.push({ id: "live", icon: "clock", title: "Workout in progress", body: `${t.liveTitle ?? "Your workout"} is still running.`, href: "/workout/live", tone: "action" });
  if (t && !t.checkin) notes.push({ id: "checkin", icon: "smile", title: "Daily check-in", body: "You haven't checked in today. It takes 20 seconds.", href: "/checkin", tone: "action" });
  const done = t?.session && t.session.status !== "in_progress" && t.session.exercises.some((e) => e.sets.some((s) => s.done));
  if (t?.planDay && !t.planDay.isRest && !t.live && !done)
    notes.push({ id: "workout", icon: "dumbbell", title: `Today: ${t.planDay.title}`, body: `${t.planDay.exercises.length} exercises, about ${t.estMinutes} min.`, href: `/workout/live?day=${t.planDay.day}`, tone: "action" });
  if (t?.planDay?.isRest) notes.push({ id: "rest", icon: "bed", title: "Rest day", body: "Recover today: walk, stretch and sleep well.", href: "/plan", tone: "info" });
  if (done) notes.push({ id: "done", icon: "trophy", title: "Workout done", body: "Nice work. See how it went.", href: `/workout/summary/${t!.session!.id}`, tone: "info" });
  if (aiConnected === false) notes.push({ id: "ai", icon: "bot", title: "AI coach offline", body: "Add an AI provider key to get coaching and plan reviews.", href: "/profile#ai", tone: "info" });
  return notes;
}

export function Notifications({ aiConnected }: { aiConnected: boolean | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TodayData | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api.today(today()).then(setData).catch(() => {});
    load();
    window.addEventListener(DATA_CHANGED, load);
    return () => window.removeEventListener(DATA_CHANGED, load);
  }, [path]);

  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const notes = buildNotes(data, aiConnected);
  const pending = notes.filter((n) => n.tone === "action").length;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Notifications${pending ? `, ${pending} need attention` : ""}`}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-fg"
      >
        <Icon name="bell" size={19} />
        {pending > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-volt px-1 text-[10px] font-semibold text-on-accent">{pending}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-sm font-semibold text-fg">Notifications</p>
          {notes.length === 0 ? (
            <p className="px-2 py-4 text-sm text-ink-400">You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-ink-800">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.tone === "action" ? "bg-volt/15 text-volt-bright" : "bg-ink-800 text-ink-400"}`}>
                      <Icon name={n.icon} size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg">{n.title}</span>
                      <span className="block text-xs text-ink-400">{n.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
