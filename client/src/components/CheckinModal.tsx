"use client";

import { useEffect, useRef } from "react";
import type { Checkin } from "@/lib/domain";
import { CheckinCard } from "@/components/CheckinCard";

/** Today's check-in as a popup. Native <dialog>: traps focus, Esc and backdrop click close it. */
export function CheckinModal({ open, initial, onClose, onSaved }: { open: boolean; initial?: Checkin | null; onClose: () => void; onSaved: (c: Checkin) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="checkin-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-ink-600 bg-ink-900 p-0 text-ink-200 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <div className="relative">
          <button type="button" onClick={onClose} aria-label="Close check-in" className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:bg-ink-800 hover:text-fg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <CheckinCard key={initial?.updatedAt ?? "new"} large initial={initial} onSaved={onSaved} bare />
        </div>
      )}
    </dialog>
  );
}
