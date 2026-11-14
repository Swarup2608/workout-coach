"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthResponse, AuthUser } from "@/lib/domain";
import { AUTH_LOST, authApi, setCsrf } from "@/lib/api";
import { VerifyEmailGate } from "@/components/VerifyEmailGate";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Apply a fresh {user, csrfToken} from the API (e.g. after changing password or name) */
  apply: (r: AuthResponse) => void;
  /** Forget the session locally and go to /login (after logout-all, account deletion…) */
  signedOut: () => void;
  /** Re-read the user from the API (e.g. after verifying the email in another tab) */
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Pages anyone can open. Token links from emails must work without being signed in. */
export const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/landing-2"];
/** "/" (the landing page) is public too, matched exactly. */
const isPublic = (path: string) => path === "/" || PUBLIC_ROUTES.some((p) => path === p || path.startsWith(p + "/"));

/** Where signed-in users land by default. */
export const HOME = "/dashboard";

/** Only allow same-site relative redirects after login (no open redirect). */
export const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") && next !== "/" ? next : HOME);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationRequired, setVerificationRequired] = useState(true);
  const router = useRouter();
  const path = usePathname();

  const apply = useCallback((r: AuthResponse) => {
    setCsrf(r.csrfToken);
    setUser(r.user);
    setVerificationRequired(r.emailVerificationRequired);
  }, []);

  const reload = useCallback(async () => apply(await authApi.me()), [apply]);

  const signedOut = useCallback(() => {
    setCsrf(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  // Restore the session on load (the API refreshes an expired access token automatically).
  useEffect(() => {
    authApi
      .me()
      .then(apply)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [apply]);

  // Session lost mid-use (refresh token expired or revoked elsewhere).
  useEffect(() => {
    const onLost = () => {
      setCsrf(null);
      setUser(null);
    };
    window.addEventListener(AUTH_LOST, onLost);
    return () => window.removeEventListener(AUTH_LOST, onLost);
  }, []);

  // Route guard: signed-out users only see /login and /signup; signed-in users skip them.
  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic(path)) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, user, path, router]);

  const value: AuthCtx = {
    user,
    loading,
    apply,
    signedOut,
    reload,
    login: async (email, password) => apply(await authApi.login(email, password)),
    register: async (name, email, password) => apply(await authApi.register(name, email, password)),
    logout: async () => {
      await authApi.logout().catch(() => {});
      signedOut();
    },
  };

  // Public pages (landing, login…) render right away; private ones wait for the session check.
  const blocked = !isPublic(path) && (loading || !user);
  const needsVerification = !!user && !user.emailVerified && verificationRequired && !isPublic(path);
  return (
    <Ctx.Provider value={value}>
      {needsVerification ? (
        <VerifyEmailGate />
      ) : blocked ? (
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-400">
          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden /> Loading…
        </div>
      ) : (
        children
      )}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
