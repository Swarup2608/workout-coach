import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DisciplineArticle } from "@/components/landing/blog/DisciplineArticle";
import { DISCIPLINES, getDiscipline } from "@/components/landing/disciplines";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return DISCIPLINES.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getDiscipline((await params).slug);
  return d ? { title: `${d.title} — StarkFitIQ`, description: d.excerpt } : {};
}

export default async function DisciplinePage({ params }: Props) {
  const d = getDiscipline((await params).slug);
  if (!d) notFound();
  return <DisciplineArticle d={d} />;
}
