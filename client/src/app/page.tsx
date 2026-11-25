import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "StarkFitIQ — Train like you engineered it.",
  description: "Plan your week, log every set, and get a weekly score with AI coaching on exactly what to change next.",
};

/** Public home page. Signed-in visitors get "Open dashboard" CTAs. */
export default function Home() {
  return <LandingPage />;
}
