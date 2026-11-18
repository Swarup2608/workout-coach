import type { Metadata } from "next";
import { DisciplineIndex } from "@/components/landing/blog/DisciplineIndex";

export const metadata: Metadata = {
  title: "Training guides — StarkFitIQ",
  description: "Short guides on strength, technique, cardio, mobility, sport and consistency, and how StarkFitIQ tracks each one.",
};

export default function DisciplinesPage() {
  return <DisciplineIndex />;
}
