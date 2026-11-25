"use client";

import { useAuth } from "@/components/AuthProvider";

/**
 * Content column beside the desktop sidebar. The sidebar only renders for a signed-in user, so the
 * left offset is applied only then — otherwise auth pages (login, signup…) sit 15rem off-centre.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return <div className={`transition-[padding] duration-200 ease-out${user ? " lg:pl-[var(--sidebar-w)]" : ""}`}>{children}</div>;
}
