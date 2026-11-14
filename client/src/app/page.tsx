import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "StarkFitIQ — Your AI fitness coach",
  description: "Plan your week, log every set, and get a weekly score with AI coaching on what to change next.",
};

/** Public landing page (the starkfitiq 3 UI). Signed-in visitors get "Open dashboard" CTAs. */
export default function Home() {
  return <LandingPage />;
}
