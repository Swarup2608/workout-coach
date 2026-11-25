import { Sidebar } from "@/components/Sidebar";
import { AppShell } from "@/components/AppShell";
import { Nav } from "@/components/Nav";
import { MobileTabs } from "@/components/MobileTabs";
import { CoachProvider } from "@/components/coach/CoachProvider";
import { CoachDock } from "@/components/coach/CoachDock";

/**
 * Signed-in app: top nav, a centred content column, the coach chat dock on the
 * bottom of every page and (on phones) a bottom tab bar. The home page, guides and auth pages ((auth) group) sit outside it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CoachProvider>
      <Sidebar />
      <AppShell>
        <Nav />
        {/* Bottom padding keeps content clear of the coach button (and the tab bar on phones). */}
        <main className="mx-auto max-w-7xl px-4 pb-36 pt-8 md:pb-24">{children}</main>
      </AppShell>
      <CoachDock />
      <MobileTabs />
    </CoachProvider>
  );
}
