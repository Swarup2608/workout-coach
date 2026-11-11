"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api";
import { useUrlToken } from "@/lib/useUrlToken";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function VerifyEmailPage() {
  const token = useUrlToken();
  const { user, reload } = useAuth();
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (token === undefined || ran.current) return;
    ran.current = true; // the token is single-use: never submit it twice (React strict mode runs effects twice)
    if (!token) {
      setState("failed");
      setError("This page needs the link from your verification email.");
      return;
    }
    authApi
      .verifyEmail(token)
      .then(async () => {
        setState("done");
        await reload().catch(() => {});
      })
      .catch((e) => {
        setState("failed");
        setError(e instanceof Error ? e.message : "Verification failed");
      });
  }, [token, reload]);

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="h-display text-4xl">Verify email</h1>
      <div className="card mt-6 space-y-4">
        {state === "working" && (
          <p className="flex items-center gap-2 text-sm text-ink-400">
            <Spinner /> Verifying…
          </p>
        )}
        {state === "done" && (
          <>
            <p className="text-sm text-good">Your email is verified.</p>
            <Link href={user ? "/dashboard" : "/login"} className="btn btn-primary w-full">
              {user ? "Go to dashboard" : "Sign in"}
            </Link>
          </>
        )}
        {state === "failed" && (
          <>
            <p className="text-sm text-bad">{error}</p>
            <Link href={user ? "/dashboard" : "/login"} className="btn btn-ghost w-full">
              {user ? "Send a new link" : "Sign in to send a new link"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
