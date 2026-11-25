const STEPS = [
  { n: "01", title: "Plan", lead: "Build your training week.", body: "Start from a baseline plan or build your own around the kit you have — nothing, dumbbells or a full gym.", tone: "orange" },
  { n: "02", title: "Log", lead: "Track every set and rep.", body: "Open the day and your exercises are waiting. Tick sets, adjust reps, load and RPE, add cardio and food.", tone: "green" },
  { n: "03", title: "Improve", lead: "Get your weekly score.", body: "One number, plus coaching on exactly what to change next week — more load, more protein, or a lighter day.", tone: "sky" },
];

export function HowItWorks() {
  return (
    <section id="how" className="l2-section">
      <div className="l2-wrap">
        <div className="l2-head">
          <span className="l2-eyebrow" data-r>
            How it works
          </span>
          <h2 className="l2-h2">Plan. Log. Improve.</h2>
        </div>
        <ol className="l2-steps">
          {STEPS.map((s) => (
            <li key={s.n} className={`l2-step l2-tone-${s.tone}`}>
              <span className="l2-step-n">{s.n}</span>
              <h3 className="l2-h3">{s.title}</h3>
              <p className="l3-step-lead">{s.lead}</p>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
