/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { DISCIPLINES } from "../disciplines";

/** One card per discipline guide, with the system cards' gold edge (.home-edge). */
export function Disciplines() {
  return (
    <section id="disciplines" className="l2-section">
      <div className="l2-wrap">
        <div className="l2-head l2-head-split">
          <div>
            <span className="l2-eyebrow" data-r>
              One coach · Every discipline
            </span>
            <h2 className="l2-h2">Built for the way you train.</h2>
          </div>
          <p className="l2-lead" data-r>
            Strength, cardio, mobility or sport — plan it your way and StarkFitIQ tracks and scores it.
          </p>
        </div>
        <div className="l3-disc">
          {DISCIPLINES.map((d, i) => (
            <Link key={d.slug} className="l3-disc-card" href={`/disciplines/${d.slug}`} data-r>
              <img src={d.img} alt="" loading="lazy" style={{ objectPosition: d.focus }} />
              <div className="l3-disc-meta">
                <span className="l3-disc-tag">
                  {String(i + 1).padStart(2, "0")} · {d.tag}
                </span>
                <h3 className="l2-h3">{d.title}</h3>
                <span className="l3-disc-note">{d.note}</span>
                <span className="l3-disc-read">Read · {d.readMins} min →</span>
              </div>
              <span className="home-edge" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
