"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { LogoMark } from "@/components/Logo";
import { PHOTOS, useMagnetic } from "../lib";
import { Arrow } from "../shared";

export function CTA() {
  const { user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const btn = useMagnetic<HTMLButtonElement>(0.3);

  // Hands the email to the signup form, which pre-fills it.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    router.push(/^\S+@\S+\.\S+$/.test(v) ? `/signup?email=${encodeURIComponent(v)}` : "/signup");
  };

  return (
    <section id="download" className="cta">
      <div className="cta-bg">
        <img src={PHOTOS.gymInterior} alt="" loading="lazy" data-speed="1.2" />
      </div>
      <div className="cta-shade" aria-hidden="true" />
      <div className="container cta-inner">
        <div data-reveal>
          <LogoMark size={92} className="cta-mark" />
        </div>
        <h2 className="cta-title disp" data-reveal>
          Your body.
          <br />
          <span className="accent">Engineered.</span>
        </h2>
        {user ? (
          <>
            <p className="lead" data-reveal>
              Your plan, logs and scores are waiting.
            </p>
            <div className="cta-form" data-reveal>
              <Link className="btn btn-accent btn-lg" href="/dashboard">
                Open your dashboard
                <Arrow />
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="lead" data-reveal>
              Create your free account and train with StarkFitIQ today.
            </p>
            <form className="cta-form" onSubmit={submit} data-reveal>
              <label htmlFor="cta-email" className="sr-only">
                Email address
              </label>
              <input id="cta-email" type="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button ref={btn} className="btn btn-accent btn-lg" type="submit">
                Get started
              </button>
            </form>
            <p className="cta-note" data-reveal>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
