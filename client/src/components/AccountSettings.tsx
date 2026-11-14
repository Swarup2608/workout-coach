"use client";

import { useCallback, useEffect, useState } from "react";
import { authApi, type DeviceSession } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { ErrorNote, Spinner } from "@/components/ui";
import { PasswordInput, passwordProblem } from "@/components/PasswordInput";

const device = (ua: string) => {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
};

export function AccountSettings() {
  const { user, apply, signedOut } = useAuth();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const loadSessions = useCallback(() => authApi.sessions().then(setSessions).catch(() => {}), []);
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  };

  const changePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(next);
    if (problem) return setError(problem);
    if (next !== confirmPw) return setError("New passwords don't match");
    run("password", async () => {
      apply(await authApi.changePassword(current, next));
      setCurrent("");
      setNext("");
      setConfirmPw("");
      setNote("Password changed. Every other device has been signed out.");
      loadSessions();
    });
  };

  const revoke = (s: DeviceSession) =>
    run(`revoke-${s.id}`, async () => {
      await authApi.revokeSession(s.id);
      if (s.current) return signedOut();
      loadSessions();
    });

  const logoutAll = () =>
    run("all", async () => {
      if (!confirm("Sign out of every device, including this one?")) return;
      await authApi.logoutAll();
      signedOut();
    });

  const deleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    run("delete", async () => {
      await authApi.deleteAccount(deletePw);
      signedOut();
    });
  };

  return (
    <section id="account" className="card scroll-mt-24 space-y-6">
      <div>
        <h2 className="h-display text-2xl">Account & security</h2>
        <p className="text-sm text-ink-400">
          Signed in as <span className="text-fg">{user?.email}</span>
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-3" onSubmit={changePassword}>
        <div>
          <label className="label" htmlFor="pw-current">Current password</label>
          <PasswordInput id="pw-current" autoComplete="current-password" value={current} onChange={setCurrent} />
        </div>
        <div>
          <label className="label" htmlFor="pw-new">New password</label>
          <PasswordInput id="pw-new" autoComplete="new-password" value={next} onChange={setNext} />
        </div>
        <div>
          <label className="label" htmlFor="pw-confirm">Confirm new password</label>
          <PasswordInput id="pw-confirm" autoComplete="new-password" value={confirmPw} onChange={setConfirmPw} />
        </div>
        <div className="md:col-span-3">
          <button className="btn btn-ghost" disabled={!!busy || !current || !next || !confirmPw}>
            {busy === "password" && <Spinner />} Change password
          </button>
        </div>
      </form>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400">Signed-in devices</h3>
          <button className="text-xs text-ink-400 hover:text-bad" onClick={logoutAll} disabled={!!busy}>
            Sign out everywhere
          </button>
        </div>
        <ul className="divide-y divide-ink-700 rounded-xl border border-ink-700">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <p className="text-fg">
                  {device(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-volt/20 px-2 py-0.5 text-[11px] text-volt-bright">This device</span>}
                </p>
                <p className="text-xs text-ink-400">
                  {s.ip || "unknown IP"} · active {new Date(s.lastActiveAt).toLocaleString()}
                </p>
              </div>
              <button className="text-xs text-ink-400 hover:text-bad" onClick={() => revoke(s)} disabled={!!busy}>
                {s.current ? "Sign out" : "Revoke"}
              </button>
            </li>
          ))}
          {!sessions.length && <li className="px-3 py-2 text-sm text-ink-400">Loading…</li>}
        </ul>
      </div>

      <ErrorNote error={error} />
      {note && <p className="text-sm text-good">{note}</p>}

      <div className="rounded-xl border border-bad/40 bg-bad/5 p-4">
        {!showDelete ? (
          <button className="text-sm text-bad hover:underline" onClick={() => setShowDelete(true)}>
            Delete my account…
          </button>
        ) : (
          <form className="space-y-3" onSubmit={deleteAccount}>
            <p className="text-sm">
              This permanently deletes your account, plans, logs, scores, chat and saved AI key. It can&apos;t be undone.
            </p>
            <div className="max-w-sm">
              <label className="label" htmlFor="pw-delete">Confirm with your password</label>
              <PasswordInput id="pw-delete" autoComplete="current-password" value={deletePw} onChange={setDeletePw} />
            </div>
            <div className="flex gap-2">
              <button className="btn bg-bad text-white hover:bg-bad/80" disabled={!!busy || !deletePw}>
                {busy === "delete" && <Spinner />} Delete permanently
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowDelete(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
