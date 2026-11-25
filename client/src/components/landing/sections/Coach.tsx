import { Spark } from "../shared";

/** AI coach: a sample conversation that uses the same numbers as the hero. */
export function Coach() {
  return (
    <section id="coach" className="l2-section l2-alt">
      <div className="l2-wrap l3-coach-grid">
        <div>
          <span className="l2-eyebrow" data-r>
            AI coach
          </span>
          <h2 className="l2-h2">Ask. Get a straight answer.</h2>
          <p className="l2-lead" data-r>
            The coach reads your plan, logs and weekly score before it replies — so its advice is about your training, not training in general.
          </p>
        </div>
        <div className="l3-chat" data-r aria-label="Example conversation with the AI coach">
          <div className="l3-chat-head">
            <span className="l2-tip-icon">
              <Spark />
            </span>
            <div>
              <b>StarkFitIQ AI Coach</b>
              <span>Knows your plan, logs and score</span>
            </div>
          </div>
          <div className="l3-msg is-me">My squat went well this week. Should I increase the load?</div>
          <div className="l3-msg is-coach">
            <p>Great progress — you hit all 25 target reps at 100 kg, up 2.5 kg on last week.</p>
            <p className="l3-msg-k">Next session</p>
            <ul>
              <li>Increase squat to 102.5 kg.</li>
              <li>Keep the 5×5 rep range.</li>
              <li>Recovery scored 80 — check sleep before adding volume.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
