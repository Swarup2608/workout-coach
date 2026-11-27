import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-semibold">Hello</h1>
      <Link href="/login" className="rounded-lg border border-current px-5 py-2">
        Sign in
      </Link>
    </main>
  );
}
