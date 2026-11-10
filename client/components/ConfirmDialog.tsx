"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" paints the confirm button red (deletes, resets) */
  tone?: "default" | "danger";
}

/**
 * In-app replacement for window.confirm().
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: "Reset day?" }))) return;
 *   …render {dialog} somewhere in the page.
 */
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOpts(null);
  }, []);

  const dialog = opts ? <ConfirmDialog {...opts} onClose={close} /> : null;
  return { confirm, dialog };
}

function ConfirmDialog({ title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "default", onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal(); // native modal: traps focus, Esc closes, blocks the page
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      onClick={(e) => e.target === ref.current && onClose(false)} // click on backdrop
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-ink-600 bg-ink-900 p-0 text-ink-200 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="space-y-3 p-6">
        <h2 id="confirm-title" className="h-display text-xl">
          {title}
        </h2>
        {body && <div className="text-sm leading-relaxed text-ink-400">{body}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-ink-700 px-6 py-4">
        <button className="btn btn-ghost" onClick={() => onClose(false)} autoFocus>
          {cancelLabel}
        </button>
        <button className={`btn ${tone === "danger" ? "bg-bad text-white hover:opacity-90" : "btn-primary"}`} onClick={() => onClose(true)}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
