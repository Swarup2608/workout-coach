"use client";

/* eslint-disable @next/next/no-img-element */
import { useForceDarkTheme } from "@/components/ThemeToggle";
import { PHOTOS } from "@/components/landing/photos";

/**
 * Frame for the auth pages (login, signup, password reset, email verification):
 * no header, always dark, the form centred over the gym photo.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  useForceDarkTheme();
  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true">
        <img src={PHOTOS.gymInterior} alt="" />
      </div>
      <main className="auth-main">{children}</main>
    </div>
  );
}
