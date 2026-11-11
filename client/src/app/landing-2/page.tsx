"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Logo } from "@/components/Logo";
import { ScoreRing } from "@/components/landing/ScoreRing";
import hero from "@/assets/landing/v2-hero.jpg";
import coach from "@/assets/landing/v2-coach.jpg";
import plate from "@/assets/landing/v2-plate.jpg";
import avatar from "@/assets/landing/v2-avatar.jpg";
import { ArrowRight, ArrowUp, Bars, Bolt, Calendar, Check, Dumbbell, Flame, Github, Play, Star, Target, Trophy } from "@/components/landing/icons";

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || "https://github.com";
const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || GITHUB_URL;

// Landing 2 palette (light): cream background, forest green, lime accent.
const C = {
  bg: "#f7f6f1",
  panel: "#efeee6",
  ink: "#1d2b1a",
  muted: "#55604f",
  green: "#2f4a2a",
  greenDark: "#22361f",
  lime: "#cfe08a",
  limeSoft: "#e4edc0",
};

/** Landing page 2 (public): light "Your Training, Smarter & Simpler" design. */
export default function Landing2() {
  const { user } = useAuth();
  const cta = user ? { href: "/dashboard", label: "Open Dashboard" } : { href: "/signup", label: "Get Started Free" };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.bg, color: C.ink, fontFamily: "var(--font-landing2)" }}>
      <Header cta={cta} />
      <Hero cta={cta} />
      <HowItWorks />
      <Coach />
      <Results />
      <FinalCta cta={cta} />
    </div>
  );
}

type Cta = { href: string; label: string };

const Eyebrow = ({ children, light = false }: { children: React.ReactNode; light?: boolean }) => (
  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: light ? "#fff" : C.ink }}>
    <span className="h-1 w-6 rounded-full" style={{ background: C.lime }} /> {children}
  </p>
);

const DarkButton = ({ cta, className = "" }: { cta: Cta; className?: string }) => (
  <Link href={cta.href} className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-bold text-white transition hover:brightness-110 ${className}`} style={{ background: C.green }}>
    {cta.label} <ArrowRight className="h-4 w-4" />
  </Link>
);

function Header({ cta }: { cta: Cta }) {
  const nav = [
    { href: "#how", label: "How It Works" },
    { href: "#how", label: "Training Plans" },
    { href: "#coach", label: "About" },
    { href: "#reviews", label: "Reviews" },
    { href: DOCS_URL, label: "FAQ", external: true },
  ];
  return (
    <header className="sticky top-0 z-30 backdrop-blur" style={{ background: `${C.bg}e6` }}>
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-4 sm:px-6">
        <Link href="/landing-2" aria-label="StarkFitIQ home" className="pr-6 md:border-r" style={{ borderColor: "#d9d8cf" }}>
          <Logo size={26} tone="light" />
        </Link>
        <nav className="hidden gap-7 text-sm font-semibold md:flex">
          {nav.map((n, i) => (
            <a key={n.label} href={n.href} {...(n.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="border-b-2 pb-1 transition hover:opacity-70" style={{ borderColor: i === 0 ? C.green : "transparent" }}>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold sm:inline-flex" style={{ borderColor: "#cfcec5" }}>
            <Github className="h-4 w-4" /> GitHub
          </a>
          <Link href={cta.href} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: C.greenDark }}>
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero({ cta }: { cta: Cta }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-6 sm:px-6 md:grid-cols-2">
      <div className="py-6">
        <span className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em]" style={{ background: C.limeSoft, color: C.green }}>
          AI Workout Coach
        </span>
        <h1 className="mt-5 text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
          Your Training,
          <br />
          <span style={{ color: C.green }}>Smarter &amp; Simpler</span>
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed" style={{ color: C.muted }}>
          Plan, log, analyze and improve your training with an AI coach that understands your goals, history and constraints.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <DarkButton cta={cta} />
          <a href="#how" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold" style={{ background: C.panel }}>
            <Play className="h-6 w-6" /> Watch How It Works
          </a>
        </div>
        <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm" style={{ color: C.muted }}>
          {[
            { icon: <Bolt className="h-5 w-5" />, label: "Plan Smarter" },
            { icon: <Bars className="h-5 w-5" />, label: "Track Consistently" },
            { icon: <Trophy className="h-5 w-5" />, label: "Improve Faster" },
          ].map((x, i) => (
            <li key={x.label} className={`flex items-center gap-2 ${i ? "border-l pl-5" : ""}`} style={{ borderColor: "#d3d2c9" }}>
              <span style={{ color: C.green }}>{x.icon}</span> {x.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative">
        {/* multiply drops the photo's white backdrop into the page colour; the mask softens the bottom edge */}
        <Image src={hero} alt="Athlete holding a shaker bottle" priority placeholder="blur" className="relative h-auto w-full mix-blend-multiply [mask-image:linear-gradient(180deg,#000_82%,transparent)]" sizes="(min-width: 768px) 560px, 90vw" />
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Target, title: "Set Your Goals", body: "Define what you want to achieve." },
  { icon: Calendar, title: "Build Your Plan", body: "Get a personalized training plan." },
  { icon: Bars, title: "Track Progress", body: "Log workouts and see real insights." },
  { icon: Star, title: "Reach Your Best", body: "Stay consistent and hit your goals." },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[300px_1fr]">
      <div>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
          From Plan
          <br />
          <span style={{ color: C.green }}>to Progress</span>
        </h2>
        <p className="mt-4" style={{ color: C.muted }}>A simple, step-by-step workflow to take the guesswork out of training.</p>
        <a href="#coach" className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white" style={{ background: C.green }}>
          See Full Workflow <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="relative">
            <div className="h-full rounded-2xl p-5" style={{ background: C.panel }}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: C.limeSoft, color: C.green }}>0{i + 1}</span>
              <div className="mt-4 flex justify-center" style={{ color: C.green }}>
                <Icon className="h-11 w-11" />
              </div>
              <h3 className="mt-4 text-center font-bold">{title}</h3>
              <p className="mt-2 text-center text-xs leading-relaxed" style={{ color: C.muted }}>{body}</p>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 lg:block" />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Coach() {
  return (
    <section id="coach" className="mx-auto max-w-6xl scroll-mt-20 px-4 sm:px-6">
      <div className="grid items-center gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[280px_1fr_auto]" style={{ background: C.panel }}>
        <div className="relative mx-auto w-64 lg:w-full">
          <Image src={coach} alt="Athlete doing a dumbbell curl" placeholder="blur" className="h-auto w-full mix-blend-multiply" sizes="280px" />
        </div>
        <div className="lg:border-r lg:pr-8" style={{ borderColor: "#d6d5cc" }}>
          <Eyebrow>AI coaching model</Eyebrow>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">A Coach That Knows Your Training</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: C.muted }}>
            Get AI-powered recommendations based on your plans, progress and goals — whether it&apos;s building muscle, losing fat or improving endurance.
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            {["Personalized workout plans", "Exercise alternatives", "Progress tracking & insights"].map((x) => (
              <li key={x} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: C.green }}><Check className="h-4 w-4" /></span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-center gap-3">
          <ScoreRing score={86} color={C.green} track={C.lime} text={C.ink} sub={C.ink} />
          <p className="flex items-center gap-1 text-sm font-semibold" style={{ color: C.green }}>
            <ArrowUp className="h-4 w-4" /> +5 pts vs last week
          </p>
          <div className="w-60 rounded-2xl bg-white/60 p-4 text-sm">
            <p className="mb-2 font-bold">Key Metrics</p>
            {[
              { icon: Dumbbell, label: "Workouts Logged", v: "24" },
              { icon: Bars, label: "Plan Adherence", v: "92%" },
              { icon: Flame, label: "Recovery Balance", v: "88%" },
            ].map(({ icon: Icon, label, v }) => (
              <p key={label} className="flex items-center gap-3 py-1.5">
                <Icon className="h-4 w-4" /> <span style={{ color: C.muted }}>{label}</span> <strong className="ml-auto">{v}</strong>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Results() {
  return (
    <section id="reviews" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.2fr_1.6fr]">
      <div>
        <Eyebrow>Real results</Eyebrow>
        <h2 className="mt-2 text-3xl font-extrabold leading-tight">
          Trusted by
          <br />
          Fitness Enthusiasts
        </h2>
      </div>
      <figure className="lg:border-l lg:pl-8" style={{ borderColor: "#d6d5cc" }}>
        <blockquote className="text-sm leading-relaxed" style={{ color: C.muted }}>
          &quot;StarkFitIQ helped me stay consistent and reach my goals faster. The insights are spot on!&quot;
        </blockquote>
        <figcaption className="mt-3 flex items-center gap-3 text-sm">
          <Image src={avatar} alt="" width={36} height={36} className="rounded-full" />
          <span><strong className="block">Alex Chen</strong><span style={{ color: C.muted }}>Strength Trainer</span></span>
        </figcaption>
      </figure>
      <dl className="grid grid-cols-3 divide-x text-center lg:border-l lg:pl-4" style={{ borderColor: "#d6d5cc" }}>
        {[
          { v: "10K+", l: "Workouts Logged" },
          { v: "98%", l: "Plan Adherence" },
          { v: "4.9", l: "User Rating", star: true },
        ].map((s) => (
          <div key={s.l} className="px-2" style={{ borderColor: "#d6d5cc" }}>
            <dt className="sr-only">{s.l}</dt>
            <dd className="text-3xl font-extrabold">
              {s.v}
              {s.star && <span className="text-[#e7b416]"> ★</span>}
            </dd>
            <dd className="mt-1 text-xs" style={{ color: C.muted }}>{s.l}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FinalCta({ cta }: { cta: Cta }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl" style={{ background: C.greenDark }}>
        <Image src={plate} alt="" fill placeholder="blur" className="object-cover object-right opacity-80 mix-blend-luminosity [mask-image:linear-gradient(90deg,transparent_30%,#000_75%)]" sizes="(min-width: 1152px) 1100px, 100vw" />
        <div className="relative max-w-xl p-8 sm:p-10">
          <Eyebrow light>Show up. Log the work.</Eyebrow>
          <h2 className="mt-2 text-4xl font-extrabold text-white sm:text-5xl">Earn the Score.</h2>
          <p className="mt-3 text-sm text-white/85">StarkFitIQ — an AI workout coach built around your actual training data.</p>
          <Link href={cta.href} className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 font-bold transition hover:brightness-105" style={{ background: C.lime, color: C.greenDark }}>
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
