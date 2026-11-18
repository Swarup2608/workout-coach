"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/** An accent follower that grows over links, buttons and media (pointer devices only). */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) {
      el.style.display = "none";
      return;
    }
    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.("a, button, [data-cursor]") as HTMLElement | null;
      el.classList.toggle("is-hover", !!t);
      el.dataset.label = t?.dataset.cursor || "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerover", over);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
    };
  }, []);
  return <div className="cursor" ref={ref} aria-hidden="true" />;
}
