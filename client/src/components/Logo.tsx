import Image from "next/image";
import icon from "@/assets/StarkFitIq Icon.png";

/**
 * StarkFitIQ logo: the StarkFitIq Icon.png mark (icon only) + "StarkFit" + accent "IQ".
 * `tone="light"` is for light backgrounds (landing page 2).
 */
export function Logo({ size = 28, tone = "dark", accent }: { size?: number; tone?: "dark" | "light"; accent?: string }) {
  const color = accent ?? (tone === "dark" ? "var(--color-volt)" : "#2f4a2a");
  const h = Math.round(size * 1.25);
  return (
    <span className="inline-flex items-center gap-2" style={{ fontSize: size * 0.85 }}>
      <Image src={icon} alt="" height={h} width={Math.round(h * 1.5)} className="shrink-0 rounded-md" sizes={`${Math.round(h * 1.5)}px`} priority />
      <span className={`font-bold tracking-tight ${tone === "dark" ? "text-white" : "text-[#1d2b1a]"}`} style={{ fontFamily: tone === "dark" ? "var(--font-sans)" : "var(--font-landing2)" }}>
        StarkFit<span style={{ color }}>IQ</span>
      </span>
    </span>
  );
}
