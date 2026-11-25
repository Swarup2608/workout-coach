const PROVIDERS = ["Claude", "OpenAI", "Gemini", "Groq", "Mistral", "OpenRouter"];

/** AI integrations: the providers the coach can run on. */
export function Integrations() {
  return (
    <section className="l2-section l2-alt">
      <div className="l2-wrap l2-narrow">
        <div className="l3-int" data-r>
          <div>
            <span className="l2-eyebrow">AI integrations</span>
            <h2 className="l2-h2">Use the model you already trust.</h2>
            <p className="l2-lead">Add a key in Profile and the coach runs on it. Any OpenAI-compatible API works too.</p>
          </div>
          <ul className="l3-providers">
            {PROVIDERS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
