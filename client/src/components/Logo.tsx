/* eslint-disable @next/next/no-img-element */
/**
 * StarkFitIQ brand marks, from the PNG set in public/brand/.
 *
 * Each variant renders a version for dark backgrounds and one for light backgrounds;
 * CSS in globals.css (.on-dark-only / .on-light-only) shows the one matching <html data-theme>.
 * Pass `tone` to pin a variant regardless of theme (e.g. on a photo, which is always dark).
 *
 *   horizontal  960×201  — nav bars, footers
 *   stacked     720×532  — auth pages, splash
 *   mark        512×585  — icon-only spots
 */
type Tone = "auto" | "dark" | "light";

const SRC = {
  horizontal: { dark: "/brand/logo-horizontal-dark.png", light: "/brand/logo-horizontal-light.png", ratio: 960 / 201 },
  stacked: { dark: "/brand/logo-stacked-dark.png", light: "/brand/logo-stacked-light.png", ratio: 720 / 532 },
  mark: { dark: "/brand/mark-dark.png", light: "/brand/mark-light.png", ratio: 512 / 585 },
} as const;

type Variant = keyof typeof SRC;

/** `size` is the rendered height in px. `tone`: "dark" = for dark backgrounds, "light" = for light ones. */
export function BrandImage({
  variant,
  size,
  tone = "auto",
  className = "",
  alt = "StarkFitIQ",
}: {
  variant: Variant;
  size: number;
  tone?: Tone;
  className?: string;
  alt?: string;
}) {
  const s = SRC[variant];
  const w = Math.round(size * s.ratio);
  const img = (src: string, cls: string, a: string) => (
    <img src={src} alt={a} width={w} height={size} className={`block shrink-0 ${cls} ${className}`} style={{ height: size, width: "auto" }} decoding="async" />
  );
  if (tone === "dark") return img(s.dark, "", alt);
  if (tone === "light") return img(s.light, "", alt);
  return (
    <>
      {img(s.dark, "on-dark-only", alt)}
      {img(s.light, "on-light-only", alt)}
    </>
  );
}

/**
 * Horizontal logo, sized by height. `tone="light"` keeps the old meaning (for light backgrounds),
 * so landing-2 keeps working; the default follows the theme.
 */
export function Logo({ size = 28, tone = "auto", className = "" }: { size?: number; tone?: Tone; className?: string; accent?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <BrandImage variant="horizontal" size={size} tone={tone} />
    </span>
  );
}

export function LogoMark({ size = 40, tone = "auto", className = "" }: { size?: number; tone?: Tone; className?: string }) {
  return <BrandImage variant="mark" size={size} tone={tone} className={className} alt="" />;
}
