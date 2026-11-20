"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/domain";
import { today } from "@/lib/api";
import { Icon } from "@/components/Icons";

/** Fired when the top-bar date changes while the Log page is open, so it can switch days in place. */
export const DATE_PICKED = "sfiq:date-picked";
/** Fired by the Log page when its own date changes, so the selector shows the same day. */
export const DATE_SHOWN = "sfiq:date-shown";

/**
 * Top-bar day navigator. Today → Today page; any other day → that day's log.
 * On the Log page it follows (and drives) the page's date.
 */
export function DateSelector() {
  const router = useRouter();
  const path = usePathname();
  const [date, setDate] = useState(today());
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = path.startsWith("/log") ? new URLSearchParams(window.location.search).get("date") : null;
    setDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today());
  }, [path]);

  useEffect(() => {
    const onShown = (e: Event) => setDate((e as CustomEvent<string>).detail);
    window.addEventListener(DATE_SHOWN, onShown);
    return () => window.removeEventListener(DATE_SHOWN, onShown);
  }, []);

  const pick = (d: string) => {
    setDate(d);
    if (path.startsWith("/log")) {
      window.history.replaceState(null, "", `/log?date=${d}`);
      window.dispatchEvent(new CustomEvent(DATE_PICKED, { detail: d }));
    } else if (d === today()) router.push("/dashboard");
    else router.push(`/log?date=${d}`);
  };

  const isToday = date === today();
  const label = new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => pick(addDays(date, -1))} aria-label="Previous day" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-fg">
        <Icon name="chevronLeft" size={18} />
      </button>
      <button
        type="button"
        onClick={() => picker.current?.showPicker?.()}
        className="relative flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-fg hover:bg-ink-800"
        aria-label={`Selected day: ${label}. Choose a date`}
      >
        <Icon name="calendar" size={17} className="text-ink-400" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{new Date(date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
        {!isToday && <span className="hidden rounded-md bg-ink-800 px-1.5 py-0.5 text-[11px] text-ink-400 md:inline">past day</span>}
        <input
          ref={picker}
          type="date"
          tabIndex={-1}
          aria-hidden
          max={today()}
          value={date}
          onChange={(e) => e.target.value && pick(e.target.value)}
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </button>
      <button
        type="button"
        onClick={() => pick(addDays(date, 1))}
        disabled={isToday}
        aria-label="Next day"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}
