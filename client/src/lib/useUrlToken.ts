"use client";

import { useEffect, useState } from "react";

/**
 * The token read from the address bar, kept outside React. The effect below can run more than once
 * (React strict mode in development, or the page remounting while auth loads), and after the first run
 * the token is already gone from the URL, so later runs read it from here instead.
 */
let captured: { path: string; token: string } | null = null;

/**
 * Reads ?token= from an email link once, then removes it from the address bar so it doesn't
 * linger in browser history or get shared by copying the URL.
 * Returns undefined while reading, then the token or null.
 */
export function useUrlToken() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");
    if (t) {
      captured = { path: url.pathname, token: t };
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setToken(t ?? (captured?.path === url.pathname ? captured.token : null));
  }, []);
  return token;
}
