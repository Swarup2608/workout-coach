"use client";

import { useState } from "react";

/** Mirrors the server's password rule for instant feedback (the server still enforces it). */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[a-z]/i.test(p) || !/\d/.test(p)) return "Password must contain at least one letter and one number";
  return null;
}

export function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        className="input pr-16"
        autoComplete={autoComplete}
        required
        maxLength={128}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs text-ink-400 hover:text-fg"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
