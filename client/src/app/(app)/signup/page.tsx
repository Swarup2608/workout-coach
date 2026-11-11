"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNext, useAuth } from "@/components/AuthProvider";
import { ErrorNote, Spinner } from "@/components/ui";
import Image from "next/image";
import logo from "@/assets/StarkFitIq.png";
import { PasswordInput, passwordProblem } from "@/components/PasswordInput";

function SignupForm() {
  const { user, register } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  const problem = passwordProblem(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    setError(null);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <Image src={logo} alt="StarkFitIQ" priority width={240} height={160} sizes="240px" className="mx-auto mb-6 rounded-2xl" />
      <h1 className="h-display text-4xl">Create account</h1>
      <p className="mt-1 text-sm text-ink-400">You start with the baseline weekly plan; change it any time.</p>
      <form className="card mt-6 space-y-4" onSubmit={submit} noValidate>
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" className="input" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <PasswordInput id="password" autoComplete="new-password" value={password} onChange={setPassword} />
          <p className={`mt-1 text-xs ${password && problem ? "text-warn" : "text-ink-400"}`}>{password && problem ? problem : "8+ characters with at least one letter and one number."}</p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} />
          {mismatch && <p className="mt-1 text-xs text-warn">Passwords don&apos;t match</p>}
        </div>
        <ErrorNote error={error} />
        <button className="btn btn-primary w-full" disabled={busy || !name.trim() || !email || !password || !confirm}>
          {busy && <Spinner />} Create account
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-400">
        Already have an account?{" "}
        <Link href={`/login${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-volt-bright hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
