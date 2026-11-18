"use client";

import { useAuth } from "@/components/AuthProvider";

/** Where "start" buttons go: the dashboard when signed in, otherwise signup. */
export function useStartHref() {
  const { user } = useAuth();
  return user ? "/dashboard" : "/signup";
}

export const Arrow = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
