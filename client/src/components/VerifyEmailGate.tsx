"use client";

import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorNote, Spinner } from "@/components/ui";

/** Shown instead of the app until the user clicks the link in their verification email. */
export function VerifyEmailGate() {
  const { user, logout, reload } = useAuth();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verified in another tab? Pick it up when this tab regains focus.
  useEffect(() => {
    const onFocus = () => reload().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const resend = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.resendVerification();
      if (r.alreadyVerified) await reload();
      else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-md">
      <h1 className="h-display text-4xl">Check your inbox</h1>
      <div className="card mt-6 space-y-4">
        <p className="text-sm leading-relaxed">
          We sent a verification link to <strong className="text-fg">{user?.email}</strong>. Click it to start using StarkFitIQ. The link expires in 24 hours.
        </p>
        <p className="text-xs text-ink-400">Can&apos;t find it? Check spam, or send a new link (the old one stops working).</p>
        <ErrorNote error={error} />
        {sent && <p className="text-sm text-good">New link sent.</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={resend} disabled={busy}>
            {busy && <Spinner />} Resend link
          </button>
          <button className="btn btn-ghost" onClick={() => reload().catch(() => {})}>
            I&apos;ve verified
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
