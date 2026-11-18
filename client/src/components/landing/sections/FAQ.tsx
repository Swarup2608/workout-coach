"use client";

import { useState } from "react";

const QA: [string, string][] = [
  ["Do I need a gym or equipment?", "No. Write your plan around whatever you have — nothing, dumbbells or a full gym — and log it the same way."],
  ["Which AI providers work?", "Claude, OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible API. Add your key in Profile. Without one, you still get the app’s own weekly scoring, plus a copy-and-paste check-in for a Claude Project."],
  ["I’m a complete beginner. Is it for me?", "Yes. Start from the baseline plan, log what you do, and the weekly score shows what to work on. The coach explains its suggestions in plain language."],
  ["Is my data private?", "Your plans, logs and scores are tied to your account and only you can see them. Your AI key is stored encrypted and used only for your own requests."],
];

export function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section">
      <div className="container faq-wrap">
        <h2 className="h2 disp center" data-reveal>
          Questions, answered.
        </h2>
        <div className="faq">
          {QA.map(([q, a], i) => (
            <div className={`faq-item ${open === i ? "on" : ""}`} key={q} data-reveal>
              <button className="faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{q}</span>
                <span className="faq-plus" aria-hidden="true" />
              </button>
              <div className="faq-a">
                <div>
                  <p>{a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
