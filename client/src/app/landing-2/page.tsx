import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import LandingPage2 from "@/components/landing2/LandingPage2";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--l2-f-disp", display: "swap" });
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--l2-f-body", display: "swap" });

export const metadata: Metadata = {
  title: "StarkFitIQ — Plan it. Log it. Score it.",
  description: "Plan your week, log every set, and get a weekly score with AI coaching on what to change next.",
};

/** Landing page 2: block-based, energy-orange redesign of the public landing page. */
export default function LandingTwo() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <LandingPage2 />
    </div>
  );
}
