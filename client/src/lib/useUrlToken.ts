"use client";

import { useEffect, useState } from "react";

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
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    setToken(t);
  }, []);
  return token;
}
