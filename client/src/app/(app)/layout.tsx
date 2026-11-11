import { Nav } from "@/components/Nav";

/** Signed-in app + auth pages: top nav and a centred content column. Landing pages sit outside this group. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
