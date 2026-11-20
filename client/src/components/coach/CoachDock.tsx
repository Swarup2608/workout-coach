"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCoach } from "./CoachProvider";
import { ChatInput, ChatThread } from "./ChatThread";

/** Pages without the dock: sign-in flows, onboarding, and /chat (already the full chat). */
export const NO_DOCK = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/onboarding", "/chat"];

/**
 * The coach chat on every signed-in page. Closed it's a round icon button at the bottom right;
 * open it's a panel on desktop and a sheet on phones.
 */
export function CoachDock() {
  const { user } = useAuth();
  const path = usePathname();
  const { open, setOpen, unread, streaming, page, aiConnected } = useCoach();
  const panel = useRef<HTMLDivElement>(null);
  const live = path.startsWith("/workout/live");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key !== "Tab" || !panel.current) return;
      // Keep keyboard focus inside the open panel.
      const items = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),textarea,input,select");
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!user || NO_DOCK.some((p) => path.startsWith(p))) return null;

  const busy = streaming !== null;

  if (!open) {
    const label = busy ? "Coach is replying…" : "Ask your coach";
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        className={`fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-volt text-on-accent shadow-lg shadow-black/25 transition hover:scale-105 hover:brightness-110 md:bottom-6 md:right-6 ${
          live ? "bottom-24" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <ChatIcon size={24} className="text-on-accent" />
        {(unread || busy) && <Dot />}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-label="Coach chat"
        className="fixed inset-x-0 bottom-0 top-14 z-50 flex flex-col rounded-t-2xl border border-ink-700 bg-ink-950 shadow-2xl md:inset-auto md:bottom-4 md:right-4 md:h-[600px] md:max-h-[calc(100vh-6rem)] md:w-[420px] md:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <ChatIcon />
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold uppercase text-fg">Coach</p>
            <p className="truncate text-xs text-ink-400">
              {page ? `Sees: ${page.page}${page.detail ? ` · ${page.detail}` : ""}` : "Sees your plan, logs and scores"}
              {aiConnected === false && " · no AI key"}
            </p>
          </div>
          <Link href="/chat" className="text-xs link">
            Full chat
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close coach chat" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-fg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <ChatThread compact />
        </div>
        <div className="border-t border-ink-700 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <ChatInput autoFocus />
        </div>
      </div>
    </>
  );
}

const Dot = () => <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-good ring-2 ring-ink-950" aria-label="New reply" />;

function ChatIcon({ size = 18, className = "text-volt-bright" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}
