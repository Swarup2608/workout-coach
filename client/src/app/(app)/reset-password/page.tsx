"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { useUrlToken } from "@/lib/useUrlToken";
import { useAuth } from "@/components/AuthProvider";
import { ErrorNote, Spinner } from "@/components/ui";
import { PasswordInput, passwordProblem } from "@/components/PasswordInput";

export default function ResetPasswordPage() {
  const token = useUrlToken();
  const { user, signedOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = passwordProblem(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      // The reset signs out every device, including this one if it was signed in.
      if (user) signedOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  if (token === undefined) return null;

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="h-display text-4xl">New password</h1>
      {done ? (
        <div className="card mt-6 space-y-4">
          <p className="text-sm text-good">Password changed. All devices were signed out.</p>
          <Link href="/login" className="btn btn-primary w-full">Sign in</Link>
        </div>
      ) : !token ? (
        <div className="card mt-6 space-y-4">
          <p className="text-sm">This page needs the link from your reset email.</p>
          <Link href="/forgot-password" className="btn btn-primary w-full">Request a reset link</Link>
        </div>
      ) : (
        <form className="card mt-6 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="label" htmlFor="password">New password</label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} />
            <p className={`mt-1 text-xs ${password && problem ? "text-warn" : "text-ink-400"}`}>{password && problem ? problem : "8+ characters with at least one letter and one number."}</p>
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm new password</label>
            <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          </div>
          <ErrorNote error={error} />
          {error?.includes("expired") && (
            <Link href="/forgot-password" className="block text-sm text-volt-bright hover:underline">Request a new link</Link>
          )}
          <button className="btn btn-primary w-full" disabled={busy || !password || !confirm}>
            {busy && <Spinner />} Set new password
          </button>
        </form>
      )}
    </div>
  );
}
