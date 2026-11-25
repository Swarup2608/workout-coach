import Image from "next/image";

/**
 * StarkFitIQ brand marks, from public/brand/:
 *
 *   Logo.png     1254×1254  — full logo (mark + wordmark + tagline): auth pages, splash
 *   LogoNav.png  2172×724   — horizontal logo (mark + wordmark): nav bars, footers
 *   Favicon.png  1254×1254  — the "S" mark alone: icon-only spots, browser tab
 *
 * Both are metallic artwork on a transparent background, so one file serves light and dark themes.
 * They're large PNGs; next/image serves resized, compressed copies at the rendered size.
 * Each has ~10% transparent padding around the artwork, so the visible mark is a little smaller than `size`.
 */
const SRC = {
  stacked: "/brand/Logo.png",
  mark: "/brand/Favicon.png",
} as const;

type Variant = keyof typeof SRC;

/** Square brand image; `size` is the rendered height (and width) in px. */
export function BrandImage({
  variant,
  size,
  className = "",
  alt = "StarkFitIQ",
  priority = false,
}: {
  variant: Variant;
  size: number;
  className?: string;
  alt?: string;
  priority?: boolean;
  /** @deprecated the artwork works on both themes; kept so older call sites still compile */
  tone?: "auto" | "dark" | "light";
}) {
  return (
    <Image
      src={SRC[variant]}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      className={`block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** LogoNav.png is 2172×724 (3:1). */
const NAV_RATIO = 2172 / 724;

/**
 * Nav/footer logo (LogoNav.png: mark + wordmark side by side), sized by height in px.
 * The wordmark fills only the middle third of the image's height, so call sites pass ~2× a normal logo height.
 */
export function Logo({ size = 48, className = "" }: { size?: number; tone?: "auto" | "dark" | "light"; className?: string; accent?: string }) {
  const width = Math.round(size * NAV_RATIO);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/brand/LogoNav.png"
        alt="StarkFitIQ"
        width={width}
        height={size}
        priority
        className="block shrink-0"
        style={{ width, height: size }}
      />
    </span>
  );
}

export function LogoMark({ size = 40, className = "" }: { size?: number; tone?: "auto" | "dark" | "light"; className?: string }) {
  return <BrandImage variant="mark" size={size} className={className} alt="" />;
}
