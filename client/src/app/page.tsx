"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { ScoreRing } from "@/components/landing/ScoreRing";
import heroAthlete from "@/assets/landing/hero-athlete.jpg";
import scoringAthlete from "@/assets/landing/scoring-athlete.jpg";
import plate from "@/assets/landing/plate.jpg";
import avatar from "@/assets/landing/avatar.jpg";
import {
  ArrowRight, ArrowUp, Bars, Bolt, Calendar, Chat, Check, Dumbbell, FileText, Github, Instagram, Layers,
  Play, ShieldStar, Sparkle, Target, Trend, Trophy, User, XLogo, Youtube,
} from "@/components/landing/icons";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com";
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || GITHUB_URL;

/** Landing page (public). Black + gold, matching "StarkFitIQ: Train Smarter, Progress Faster". */
export default function Landing() {
  const { user } = useAuth();
  const cta = user ? { href: "/dashboard", label: "Open Dashboard" } : { href: "/signup", label: "Get Started Free" };

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 text-ink-200">
      <Header cta={cta} />
      <Hero cta={cta} />
      <TrainSmarter />
      <HowItWorks />
      <ScoringModel />
      <Coaching />
      <Results />
      <FinalCta cta={cta} />
      <Footer />
    </div>
  );
}

type Cta = { href: string; label: string };

const GoldButton = ({ cta, className = "" }: { cta: Cta; className?: string }) => (
  <Link href={cta.href} className={`btn btn-primary rounded-full px-6 py-3 text-[15px] ${className}`}>
    {cta.label} <ArrowRight className="h-4 w-4" />
  </Link>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-200">
    <span className="h-1 w-7 rounded-full bg-volt" /> {children}
  </p>
);

// ── Header ───────────────────────────────────────────────────
function Header({ cta }: { cta: Cta }) {
  const nav = [
    { href: "#how", label: "How It Works" },
    { href: "#scoring", label: "Scoring" },
    { href: "#features", label: "Plans" },
    { href: DOCS_URL, label: "Docs", external: true },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="StarkFitIQ home">
          <Logo size={26} />
        </Link>
        <nav className="mx-auto hidden items-center gap-1 rounded-full md:flex">
          {nav.map((n, i) => (
            <a
              key={n.label}
              href={n.href}
              {...(n.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${i === 0 ? "bg-white text-ink-950" : "text-ink-200 hover:text-white"}`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm font-semibold text-white hover:border-volt/60 sm:inline-flex">
            <Github className="h-4 w-4" /> GitHub
          </a>
          <Link href={cta.href} className="btn btn-primary rounded-full px-4 py-1.5">
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function Hero({ cta }: { cta: Cta }) {
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-10 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-14">
        <div className="relative z-10">
          <span className="inline-block rounded-full border border-white/70 px-4 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">AI Workout Coach</span>
          <h1 className="mt-5 font-display text-5xl font-black uppercase italic leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-[4.1rem]">
            Your training,
            <br />
            <span className="lg:whitespace-nowrap">
              scored <span className="text-gold">intelligently.</span>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink-200 sm:text-lg">
            Plan, log, analyze and improve your training with an AI coach that understands your goals, history and constraints.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <GoldButton cta={cta} />
            <a href="#how" className="inline-flex items-center gap-2 rounded-full border border-white/70 px-6 py-3 text-[15px] font-semibold text-white hover:border-volt">
              <Play className="h-5 w-5" /> Watch How It Works
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-200">
            {[
              { icon: <Target className="h-5 w-5" />, label: "Plan Smarter" },
              { icon: <Bars className="h-5 w-5" />, label: "Train Consistently" },
              { icon: <Bolt className="h-5 w-5" />, label: "Improve Faster" },
            ].map((x, i) => (
              <li key={x.label} className={`flex items-center gap-2 ${i ? "border-l border-white/15 pl-5" : ""}`}>
                <span className="text-volt">{x.icon}</span> {x.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-none">
          {/* gold diagonal light streaks */}
          <div className="pointer-events-none absolute -left-10 bottom-0 h-[120%] w-24 origin-bottom-left -rotate-[32deg] bg-gradient-to-t from-volt/0 via-volt/70 to-volt/0 blur-[2px]" />
          <div className="pointer-events-none absolute left-6 bottom-0 h-[110%] w-10 origin-bottom-left -rotate-[32deg] bg-gradient-to-t from-volt/0 via-volt/30 to-volt/0" />
          <div className="relative overflow-hidden rounded-3xl [mask-image:radial-gradient(120%_100%_at_55%_35%,#000_60%,transparent_100%)]">
            <Image src={heroAthlete} alt="Athlete with a towel after training" priority placeholder="blur" className="h-auto w-full object-cover" sizes="(min-width: 768px) 520px, 90vw" />
          </div>
          {/* floating stat cards */}
          <div className="absolute -right-2 top-4 flex w-48 flex-col gap-3 sm:-right-6 sm:w-56">
            <div className="glass-gold flex items-center gap-3 px-4 py-3">
              <Target className="h-8 w-8 text-volt" />
              <div>
                <p className="text-xs text-ink-200">Accuracy</p>
                <p className="font-display text-3xl font-extrabold leading-none text-white">98%</p>
              </div>
              <Trend className="ml-auto h-7 w-7 text-volt" />
            </div>
            <div className="glass-gold flex items-center gap-3 px-4 py-3">
              <Trophy className="h-8 w-8 text-volt" />
              <div>
                <p className="text-xs text-ink-200">Win Rate</p>
                <p className="font-display text-3xl font-extrabold leading-none text-white">
                  92% <span className="align-middle text-xs font-semibold text-volt">↑ +5%</span>
                </p>
              </div>
            </div>
            <div className="glass-gold flex h-16 items-end gap-1.5 px-4 pb-3">
              {[3, 5, 4, 7, 9, 12, 16, 22, 28, 34].map((h, i) => (
                <span key={i} className="w-full rounded-sm bg-gradient-to-t from-gold-deep to-volt-bright" style={{ height: `${h + 4}px`, opacity: 0.45 + i * 0.055 }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Train smarter (features) ─────────────────────────────────
const FEATURES = [
  { icon: Dumbbell, title: "Track Workouts", body: "Log exercises, sets, reps, load and activity." },
  { icon: Calendar, title: "Build Plans", body: "Create a personalized training plan in minutes." },
  { icon: Bars, title: "Score Every Week", body: "Evaluate adherence, overload and recovery." },
  { icon: Layers, title: "Review Plan Quality", body: "Check volume, recovery days and session length." },
  { icon: Chat, title: "Chat with Your Coach", body: "Discuss progress, get guidance and next steps." },
  { icon: ShieldStar, title: "Respect Constraints", body: "Flag conflicts and suggest safer alternatives." },
];

function TrainSmarter() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <h2 className="flex items-center gap-4 font-display text-4xl font-black uppercase italic text-white sm:text-5xl">
          <span className="h-2 w-12 rounded-full bg-volt" /> Train smarter.
        </h2>
        <p className="pb-1.5 text-ink-200">A complete, AI-powered training workflow to plan, track, analyze and improve.</p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.01] p-5 transition hover:border-volt/50">
            <Icon className="h-8 w-8 text-volt" />
            <h3 className="mt-4 text-lg font-bold leading-tight text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-200">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── How it works ─────────────────────────────────────────────
const STEPS = [
  { icon: User, title: "Set up", body: "Add your profile, goals and constraints." },
  { icon: FileText, title: "Import plan", body: "Paste or edit your workout plan." },
  { icon: Dumbbell, title: "Log workouts", body: "Record each training session as you go." },
  { icon: Bars, title: "Review metrics", body: "See deterministic metrics calculated by the app." },
  { icon: Sparkle, title: "Get AI insights", body: "Ask your AI coach to interpret the metrics and get a coaching report." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[230px_1fr]">
      <div>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 font-display text-4xl font-black uppercase italic leading-[0.95] text-white sm:text-5xl">
          From plan
          <br />
          to progress.
        </h2>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="relative">
            <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 pt-5">
              <span className="absolute -top-3 left-3 -skew-x-12 rounded-md bg-volt px-3 py-0.5 font-display text-sm font-extrabold italic text-ink-950">0{i + 1}</span>
              <Icon className="h-7 w-7 text-white" />
              <h3 className="mt-3 font-bold text-white">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-ink-200">{body}</p>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-volt lg:block" />}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Scoring model ────────────────────────────────────────────
/** The real weekly score weights (server/src/services/metrics.ts). */
const WEIGHTS = [
  { icon: Calendar, label: "Adherence", pct: 35 },
  { icon: Trend, label: "Progressive overload", pct: 25 },
  { icon: Target, label: "Rep-range quality", pct: 15 },
  { icon: Layers, label: "Muscle balance", pct: 15 },
  { icon: ShieldStar, label: "Recovery & safety", pct: 10 },
];

function ScoringModel() {
  return (
    <section id="scoring" className="relative scroll-mt-20 border-y border-white/5 bg-gradient-to-r from-ink-900 via-ink-950 to-ink-900">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr_auto_1fr]">
        <div className="relative hidden h-56 overflow-hidden rounded-2xl lg:block [mask-image:linear-gradient(90deg,#000_60%,transparent)]">
          <Image src={scoringAthlete} alt="Athlete doing a dumbbell curl" fill placeholder="blur" className="object-cover" sizes="260px" />
        </div>
        <div>
          <Eyebrow>Scoring model</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-black uppercase italic leading-[0.95] text-white sm:text-4xl">
            A clear, weighted score for every training week.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-200">A data-driven score that turns your training into clear, actionable progress with weighted metrics and AI insights.</p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={86} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-volt/60 px-4 py-1 text-sm font-semibold text-white">
            <ArrowUp className="h-4 w-4 text-volt" /> +5 pts vs. last week
          </span>
        </div>
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-4">
          {WEIGHTS.map(({ icon: Icon, label, pct }) => (
            <li key={label} className="flex items-center gap-3 py-2.5 text-sm text-white">
              <Icon className="h-5 w-5 text-ink-200" /> {label}
              <span className="ml-auto rounded-full bg-gradient-to-b from-volt-bright to-volt px-3 py-0.5 text-xs font-bold text-ink-950">{pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── AI coaching ──────────────────────────────────────────────
function Coaching() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 rounded-3xl border-2 border-volt/70 bg-gradient-to-br from-ink-900 to-ink-950 p-6 shadow-[0_0_60px_-20px_rgba(245,181,37,.7)] sm:p-8 lg:grid-cols-[1fr_1.3fr]">
        <div className="lg:border-r lg:border-white/10 lg:pr-8">
          <Eyebrow>AI coaching</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-black uppercase italic leading-[0.95] text-white sm:text-4xl">A coach that knows your training.</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-200">Get practical, context-aware recommendations based on your plan, recent logs and progress.</p>
          <ul className="mt-4 space-y-2 text-sm text-white">
            {["Weekly coaching report", "Plan adjustments", "Exercise alternatives", "Progress guidance"].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-volt text-ink-950"><Check className="h-3.5 w-3.5" /></span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-3">
            <Sparkle className="h-7 w-7 text-volt" />
            <p className="font-semibold text-white">StarkFitIQ Coach</p>
            <p className="ml-auto flex items-center gap-1.5 text-sm text-ink-200">
              <span className="text-lg text-[#e8743b]">✺</span> Claude Powered
            </p>
          </div>
          <div className="mt-4 flex gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-volt text-ink-950"><Dumbbell className="h-6 w-6" /></span>
            <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-4 text-sm leading-relaxed text-white">
              <p>Your week was strong! Adherence is 92% and your bench press 1RM is up by ~5%.</p>
              <p className="mt-2">Next week, consider a small volume increase (+2 sets for chest) and keep the same intensity.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-volt-bright to-volt px-4 py-2 text-sm font-bold text-ink-950"><Check className="h-4 w-4" /> Increase volume</span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">Maintain intensity</span>
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">Focus on recovery</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Real results (light band) ────────────────────────────────
function Results() {
  return (
    <section className="bg-cream text-ink-950">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.3fr_2fr]">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]"><span className="h-1 w-7 rounded-full bg-volt" /> Real results</p>
          <h2 className="mt-2 font-display text-4xl font-black uppercase italic leading-[0.92]">Trusted by trainers &amp; lifters.</h2>
        </div>
        <figure className="border-ink-950/15 lg:border-l lg:pl-8">
          <span className="font-display text-5xl font-black leading-none text-volt">“</span>
          <blockquote className="-mt-3 text-sm leading-relaxed">StarkFitIQ helped me train with more structure and consistency. The weekly score and AI feedback keep me on track.”</blockquote>
          <figcaption className="mt-3 flex items-center gap-3 text-sm">
            <Image src={avatar} alt="" width={36} height={36} className="rounded-full" />
            <span><strong className="block">Alex Chen</strong><span className="text-ink-600">Strength Trainer</span></span>
          </figcaption>
        </figure>
        <dl className="grid grid-cols-3 divide-x divide-ink-950/15 text-center">
          {[
            { v: "10K+", l: "Workouts Logged" },
            { v: "98%", l: "Plan Adherence (Avg.)" },
            { v: "4.9", l: "User Rating", star: true },
          ].map((s) => (
            <div key={s.l} className="px-2">
              <dt className="sr-only">{s.l}</dt>
              <dd className="font-display text-4xl font-extrabold">
                {s.v}
                {s.star && <span className="text-volt">★</span>}
              </dd>
              <dd className="mt-1 text-xs text-ink-600">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── Final CTA ────────────────────────────────────────────────
function FinalCta({ cta }: { cta: Cta }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-900">
        <Image src={plate} alt="" fill placeholder="blur" className="object-cover object-right opacity-90 [mask-image:linear-gradient(90deg,transparent_25%,#000_70%)]" sizes="(min-width: 1152px) 1100px, 100vw" />
        <div className="relative max-w-xl p-8 sm:p-10">
          <h2 className="font-display text-4xl font-black uppercase italic leading-[0.95] text-white sm:text-5xl">
            Show up. Log the work.
            <br />
            <span className="text-gold">Earn the score.</span>
          </h2>
          <p className="mt-3 text-sm text-ink-200">StarkFitIQ — an AI workout coach built around your actual training data.</p>
          <GoldButton cta={cta} className="mt-6" />
        </div>
      </div>
    </section>
  );
}

// ── Footer ───────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-4 py-6 text-sm sm:px-6">
        <div className="flex items-center gap-4">
          <Logo size={24} />
          <span className="hidden border-l border-white/15 pl-4 text-xs text-ink-200 sm:inline">Train Smarter. Progress Faster.</span>
        </div>
        <nav className="flex flex-wrap gap-5 text-xs text-ink-200">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#how" className="hover:text-white">How It Works</a>
          <a href="#scoring" className="hover:text-white">Scoring</a>
          <a href="#features" className="hover:text-white">Plans</a>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white">Docs</a>
        </nav>
        <div className="flex gap-4 text-white">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-volt"><Github /></a>
          <a href="#" aria-label="X" className="hover:text-volt"><XLogo /></a>
          <a href="#" aria-label="YouTube" className="hover:text-volt"><Youtube /></a>
          <a href="#" aria-label="Instagram" className="hover:text-volt"><Instagram /></a>
        </div>
        <p className="text-xs text-ink-200 lg:ml-auto">© {new Date().getFullYear()} StarkFitIQ. All rights reserved.</p>
      </div>
    </footer>
  );
}
