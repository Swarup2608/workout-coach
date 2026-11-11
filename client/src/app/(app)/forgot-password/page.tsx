"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { ErrorNote, Spinner } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDone((await authApi.forgotPassword(email.trim())).message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="h-display text-4xl">Forgot password</h1>
      <p className="mt-1 text-sm text-ink-400">Enter your account email and we&apos;ll send you a reset link.</p>
      {done ? (
        <div className="card mt-6 space-y-3">
          <p className="text-sm text-good">{done}</p>
          <p className="text-xs text-ink-400">Didn&apos;t get it? Check spam, or try again in a few minutes.</p>
        </div>
      ) : (
        <form className="card mt-6 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <ErrorNote error={error} />
          <button className="btn btn-primary w-full" disabled={busy || !email.trim()}>
            {busy && <Spinner />} Send reset link
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-ink-400">
        <Link href="/login" className="text-volt-bright hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
