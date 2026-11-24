import {
  WEEKDAYS,
  addDays,
  isLive,
  weekStartOf,
  weekdayOf,
  type PlanDay,
  type ReshuffleSuggestion,
  type WeekMove,
  type Weekday,
  type WorkoutPlan,
  type WorkoutSession,
} from "../domain.js";

/**
 * Missed-session reshuffle. Rules:
 * - A planned training day is "missed" when its date has passed and no workout this week followed it.
 * - Missed workouts move into free rest days from today on (oldest missed → earliest free day).
 * - Planned days still ahead keep their place, so the rest of the week isn't disturbed.
 * - What doesn't fit is suggested as a skip: cramming two workouts into one day isn't worth it.
 */

const isTraining = (d: PlanDay | undefined) => !!d && !d.isRest && d.exercises.length > 0;
const didSomething = (s: WorkoutSession) => !isLive(s) && (s.exercises.some((e) => e.sets.some((x) => x.done)) || (s.durationMin ?? 0) > 0);

/** The plan day a workout followed: the day it was started from, else its own weekday. */
export const followedDay = (s: Pick<WorkoutSession, "planDay" | "day">): Weekday | null => (s.planDay === "custom" ? null : (s.planDay ?? s.day));

/** Moves for the week containing `date`, if any were applied. */
export const movesFor = (plan: WorkoutPlan | null, date: string): WeekMove[] =>
  plan?.weekMoves && plan.weekMoves.weekStart === weekStartOf(date) ? plan.weekMoves.moves : [];

/** The plan day to train on `date`, following this week's moves. */
export function plannedDayFor(plan: WorkoutPlan | null, date: string): { planDay: PlanDay | null; movedFrom: Weekday | null } {
  if (!plan) return { planDay: null, movedFrom: null };
  const move = movesFor(plan, date).find((m) => m.date === date);
  if (move) return { planDay: plan.days.find((d) => d.day === move.planDay) ?? null, movedFrom: move.planDay };
  return { planDay: plan.days.find((d) => d.day === weekdayOf(date)) ?? null, movedFrom: null };
}

export function suggestReshuffle(plan: WorkoutPlan, sessions: WorkoutSession[], today: string): ReshuffleSuggestion {
  const ws = weekStartOf(today);
  const dates = WEEKDAYS.map((_, i) => addDays(ws, i));
  const week = sessions.filter((s) => s.date >= ws && s.date <= dates[6] && didSomething(s));
  const covered = new Set(week.map(followedDay).filter(Boolean));
  const busy = new Set(week.map((s) => s.date));
  const applied = movesFor(plan, today);
  const dayOf = (wd: Weekday) => plan.days.find((d) => d.day === wd);

  const missed = WEEKDAYS.filter((wd, i) => dates[i] < today && isTraining(dayOf(wd)) && !covered.has(wd)).map((wd) => ({ day: wd, title: dayOf(wd)!.title }));
  const free = dates.filter((d, i) => d >= today && !isTraining(dayOf(WEEKDAYS[i])) && !busy.has(d));
  const moves = missed.slice(0, free.length).map((m, i) => ({ date: free[i], planDay: m.day, title: m.title }));
  const skipped = missed.slice(free.length);
  return { weekStart: ws, missed, moves, skipped, applied };
}

/** Checks moves a client wants to apply: this week, today or later, distinct dates, real training days. */
export function validateMoves(plan: WorkoutPlan, moves: WeekMove[], today: string): string | null {
  const ws = weekStartOf(today);
  const end = addDays(ws, 6);
  const seen = new Set<string>();
  for (const m of moves) {
    if (m.date < today || m.date > end) return `${m.date} is not between today and Sunday`;
    if (seen.has(m.date)) return `Two workouts on ${m.date}`;
    seen.add(m.date);
    if (!isTraining(plan.days.find((d) => d.day === m.planDay))) return `${m.planDay} has no workout in your plan`;
  }
  return null;
}
