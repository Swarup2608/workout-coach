const QA: [string, string][] = [
  ["Do I need a gym or equipment?", "No. Write your plan around whatever you have — nothing, dumbbells or a full gym — and log it the same way."],
  ["Which AI providers work?", "Claude, OpenAI, Gemini, Groq, Mistral, OpenRouter or any OpenAI-compatible API. Add your key in Profile. Without one, you still get the app’s own weekly scoring, plus a copy-and-paste check-in for a Claude Project."],
  ["I’m a complete beginner. Is it for me?", "Yes. Start from the baseline plan, log what you do, and the weekly score shows what to work on. The coach explains its suggestions in plain language."],
  ["Is my data private?", "Your plans, logs and scores are tied to your account and only you can see them. Your AI key is stored encrypted and used only for your own requests."],
];

export function FAQ() {
  return (
    <section id="faq" className="l2-section">
      <div className="l2-wrap l2-narrow">
        <div className="l2-faq-grid">
          <h2 className="l2-h2">Questions, answered.</h2>
          <div className="l2-faq">
            {QA.map(([q, a], i) => (
              <details key={q} open={i === 0} data-r>
                <summary>
                  <span>{q}</span>
                  <span className="l2-plus" aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
