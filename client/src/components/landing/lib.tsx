"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import gymEntry from "@/assets/landing/hero/Athlete_entering_futuristic_gym_f5196066_1080p.mp4";
import barbell from "@/assets/landing/hero/Athlete_performing_heavy_barbell…_acd55de2_1080p.mp4";
import dumbbellPress from "@/assets/landing/hero/Athlete_performing_dumbbell_shou…_f8ba7a5e_1080p.mp4";
import trackRun from "@/assets/landing/hero/Athlete_running_on_track_2f8d1dbf_1080p.mp4";
import mobility from "@/assets/landing/hero/Athlete_performing_mobility_exer…_07f9e973_1080p.mp4";
import rooftop from "@/assets/landing/hero/Athletic_individual_on_rooftop_3a5b2f1a_1080p.mp4";
import landingFilm from "@/assets/landing/Landing film.mp4";
import mobileView from "@/assets/landing/mobile view.mp4";
import tryStrength from "@/assets/landing/try-it/Build Strength.png";
import tryFat from "@/assets/landing/try-it/lose fat.png";
import tryEndurance from "@/assets/landing/try-it/boost endurance.png";
import tryMobility from "@/assets/landing/try-it/move better.png";
import setBySetLog from "@/assets/landing/the System/setbysetlog.png";
import weeklyScoreImg from "@/assets/landing/the System/Weekly score.png";
import aiChatImg from "@/assets/landing/the System/ai chat bot.png";
import foodStatsImg from "@/assets/landing/the System/food and daily stats.png";
import quickAddImg from "@/assets/landing/the System/quick add.png";
import mealPrep from "@/assets/landing/hero/Preparing_healthy_vegetarian_fit…_591ede66_1080p.mp4";

/* ---------------------------------------------------------------------------
   Photos live in ./photos (public/media/, Unsplash License).
   Videos are imported from src/assets/landing/hero/ (see next.config.ts).
   --------------------------------------------------------------------------- */
import { media as m } from "./photos";

export type Video = { sources: string[]; poster: string };

/** Hero background: every clip in assets/landing/hero, played in order. */
export const HERO_REEL: Video = {
  sources: [gymEntry, barbell, dumbbellPress, trackRun, mobility, rooftop, mealPrep],
  poster: m("gym-interior.jpg"),
};

/** "The System" bento card images. */
export const SYSTEM = { setBySet: setBySetLog.src, weekly: weeklyScoreImg.src, aiChat: aiChatImg.src, food: foodStatsImg.src, quickAdd: quickAddImg.src };

/** Goal picker ("Try it") images. */
export const TRY_IT = { strength: tryStrength.src, fat: tryFat.src, endurance: tryEndurance.src, mobility: tryMobility.src };

export const VIDEOS: Record<"phone" | "film", Video> = {
  phone: { sources: [mobileView], poster: m("mono-athlete.jpg") },
  film: { sources: [landingFilm], poster: m("barbell-floor.jpg") },
};

export { PHOTOS } from "./photos";

/** <source> list for a single video. */
export function VideoSources({ video }: { video: Video }) {
  return (
    <>
      {video.sources.map((s) => (
        <source key={s} src={s} type="video/mp4" />
      ))}
    </>
  );
}

/**
 * Plays every clip back to back, crossfading between them, and loops the list.
 * Only the current and next clip get a src, so the rest aren't downloaded early.
 */
export function VideoReel({ video }: { video: Video }) {
  const { sources, poster } = video;
  const [i, setI] = useState(0);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const next = (i + 1) % sources.length;

  useEffect(() => {
    const v = refs.current[i];
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }, [i]);

  return (
    <>
      {sources.map((src, idx) => {
        const live = idx === i || idx === next;
        return (
          <video
            key={src}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            className={idx === i ? "is-active" : undefined}
            src={live ? src : undefined}
            poster={idx === 0 ? poster : undefined}
            autoPlay={idx === 0}
            muted
            playsInline
            preload={live ? "auto" : "none"}
            onEnded={() => idx === i && setI(next)}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/* --------------------------- helpers ------------------------------------ */

type LenisLike = { scrollTo: (t: Element, o?: { offset?: number; duration?: number }) => void; start: () => void; stop: () => void };
declare global {
  interface Window {
    __lenis?: LenisLike;
  }
}

/** Smooth-scrolls to an in-page anchor through Lenis when it is running. */
export function scrollToHash(e: React.MouseEvent, hash: string) {
  // Only same-page anchors ("#how"); links like "/#how" navigate normally.
  if (!hash.startsWith("#")) return;
  const target = document.querySelector(hash);
  if (!target) return;
  e.preventDefault();
  if (window.__lenis) window.__lenis.scrollTo(target, { offset: -70, duration: 1.4 });
  else target.scrollIntoView({ behavior: "smooth" });
}

/** Splits a string into masked words so each can slide up independently. */
export function SplitText({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="word">
            <span>{w}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}

/** CSS custom properties in a style prop, typed. */
export const vars = (v: Record<string, string | number>) => v as React.CSSProperties;
