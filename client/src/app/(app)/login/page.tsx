"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext, useAuth } from "@/components/AuthProvider";
import { ErrorNote, Spinner } from "@/components/ui";
import Image from "next/image";
import logo from "@/assets/StarkFitIq.png";
import { PasswordInput } from "@/components/PasswordInput";

function LoginForm() {
  const { user, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <Image src={logo} alt="StarkFitIQ" priority width={240} height={160} sizes="240px" className="mx-auto mb-6 rounded-2xl" />
      <h1 className="h-display text-4xl">Sign in</h1>
      <p className="mt-1 text-sm text-ink-400">Welcome back. Your plan, logs and scores are waiting.</p>
      <form className="card mt-6 space-y-4" onSubmit={submit} noValidate>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">Password</label>
            <Link href="/forgot-password" className="text-xs text-volt-bright hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </div>
        <ErrorNote error={error} />
        <button className="btn btn-primary w-full" disabled={busy || !email || !password}>
          {busy && <Spinner />} Sign in
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-400">
        New here?{" "}
        <Link href={`/signup${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-volt-bright hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
