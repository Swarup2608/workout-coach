import { AuthShell } from "@/components/AuthShell";

/** Auth pages: just the form, centred over the gym photo, dark theme only (no app header or sidebar). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
