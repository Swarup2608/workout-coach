import { WEEKDAYS, type PlanDay, type PlannedExercise, type Weekday } from "@workout/shared";
import { newId } from "../store.js";
import { classifyMuscle } from "./muscles.js";

/**
 * Parses a markdown/text workout plan (like the baseline plan) into structured days.
 * Recognises:
 *   ## Monday — Biceps + Triceps            (day headers)
 *   | EZ-bar curls | 3 × 10–12 |             (table rows)
 *   - Hanging knee raises — 2 × 10–12        (bullet rows)
 *   2 × 30–45 seconds / 2 × 12 each side      (units + per-side)
 */
const SETS_RE = /(\d+)\s*[×x]\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*(sec(?:ond)?s?|s\b)?\s*(each(?:\s+side)?)?/i;
const ROW_RE = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
const BULLET_RE = /^[-*]\s+(.+?)\s+[—–-]\s+(.+)$/;

function headerDay(line: string): { day: Weekday; title: string } | null {
  const m = line.match(/^#{1,3}\s+(.+)$/);
  if (!m) return null;
  const text = m[1].trim();
  const day = WEEKDAYS.find((d) => text.toLowerCase().startsWith(d.toLowerCase()));
  if (!day) return null;
  const title = text.slice(day.length).replace(/^\s*[—–:-]\s*/, "").trim();
  return { day, title: title || day };
}

function toExercise(rawName: string, spec: string, section: string): PlannedExercise | null {
  const m = spec.match(SETS_RE);
  if (!m) return null;
  const name = rawName.replace(/\*\*/g, "").trim();
  if (!name || /^exercise$/i.test(name)) return null;
  const alternatives = name.split(/\s+(?:OR|or)\s+/).map((s) => s.trim()).filter(Boolean);
  const repMin = Number(m[2]);
  return {
    id: newId(),
    name,
    alternatives: alternatives.length > 1 ? alternatives : [],
    section,
    sets: Number(m[1]),
    repMin,
    repMax: m[3] ? Number(m[3]) : repMin,
    unit: m[4] ? "seconds" : "reps",
    perSide: Boolean(m[5]),
    muscle: classifyMuscle(name),
  };
}

export function parsePlan(text: string): { days: PlanDay[]; goal: string } {
  const lines = text.split(/\r?\n/);
  const days = new Map<Weekday, PlanDay>();
  let current: PlanDay | null = null;
  let section = "Main";
  let goal = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!goal && /^goal\s*:/i.test(line)) goal = line.replace(/^goal\s*:\s*/i, "");

    if (/^#{1,3}\s/.test(line)) {
      const h = headerDay(line);
      if (h) {
        current = {
          day: h.day,
          title: h.title,
          isRest: /recovery|rest/i.test(h.title),
          exercises: [],
          notes: [],
        };
        days.set(h.day, current);
        section = "Main";
      } else {
        current = null; // left the per-day area (e.g. "## Daily training rules")
      }
      continue;
    }
    if (!current) continue;

    // Plain short lines without punctuation act as section labels ("Biceps", "Core").
    if (/^[A-Z][A-Za-z +&/'-]{2,40}$/.test(line) && !line.includes("|")) {
      section = line;
      continue;
    }

    const row = line.match(ROW_RE);
    if (row) {
      if (/^-+$/.test(row[1].replace(/\s/g, ""))) continue;
      const ex = toExercise(row[1], row[2], section);
      if (ex) current.exercises.push(ex);
      continue;
    }
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const ex = toExercise(bullet[1], bullet[2], section);
      if (ex) current.exercises.push(ex);
      continue;
    }
    if (/^(cardio|core|post-workout|important|friday is|pullover)/i.test(line)) {
      current.notes.push(line);
    }
  }

  const ordered = WEEKDAYS.map(
    (d) => days.get(d) ?? { day: d, title: "Rest", isRest: true, exercises: [], notes: [] },
  );
  // A day with no lifts is a rest/recovery day regardless of its title.
  for (const d of ordered) if (d.exercises.length === 0) d.isRest = true;
  return { days: ordered, goal };
}
