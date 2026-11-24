import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

const app = useTestApp("workout_test");

const PLAN = `# Test plan
## Monday
- Goblet squat — 3 × 8-12
- Push-up — 2 × 10
## Tuesday
Rest
## Wednesday
- Lat pulldown — 3 × 10
`;
const MON = "2026-11-16";
const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

describe("live workout timer", () => {
  const a = new Browser();
  let id = "";

  it("starts a workout from the plan day with the planned sets", async () => {
    await signUpVerified(a, { name: "Asha", email: "asha@example.com" });
    assert.equal((await a.call("POST", "/plans", { name: "Test", text: PLAN })).status, 201);
    const r = await a.call("POST", "/sessions/start", { date: MON, planDay: "Monday" });
    assert.equal(r.status, 201);
    const s = r.body.session;
    id = s.id;
    assert.equal(s.status, "in_progress");
    assert.ok(s.startedAt);
    assert.deepEqual(s.exercises.map((e: { name: string; sets: unknown[] }) => [e.name, e.sets.length]), [["Goblet squat", 3], ["Push-up", 2]]);
  });

  it("only one live workout at a time: starting again resumes it", async () => {
    const r = await a.call("POST", "/sessions/start", { date: "2026-11-18", planDay: "Wednesday" });
    assert.equal(r.status, 200);
    assert.equal(r.body.resumed, true);
    assert.equal(r.body.session.id, id);
    assert.equal((await a.call("GET", "/sessions/live")).body.session.id, id);
  });

  it("autosaves sets and keeps the timer fields when saved", async () => {
    const live = (await a.call("GET", "/sessions/live")).body.session;
    live.exercises[0].sets[0] = { weightKg: 20, reps: 10, negatives: null, done: true, completedAt: new Date().toISOString(), rir: 4 };
    const r = await a.call("PATCH", `/sessions/${id}`, { exercises: live.exercises.map(({ muscle, ...e }: { muscle: string }) => e) });
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "in_progress");
    assert.equal(r.body.exercises[0].sets[0].done, true);
    assert.equal(r.body.exercises[0].sets[0].rir, 4);
    const bad = structuredClone(live.exercises);
    bad[0].sets[0].rir = 7;
    assert.equal((await a.call("PATCH", `/sessions/${id}`, { exercises: bad.map(({ muscle, ...e }: { muscle: string }) => e) })).status, 400);
  });

  it("pause and resume add up paused time", async () => {
    assert.ok((await a.call("POST", `/sessions/${id}/pause`)).body.pausedAt);
    // Pretend the pause started 10 minutes ago.
    await app.col().sessions().updateOne({ id }, { $set: { pausedAt: minsAgo(10) } });
    const r = await a.call("POST", `/sessions/${id}/resume`);
    assert.equal(r.body.pausedAt, null);
    assert.ok(r.body.pausedMs >= 10 * 60000 - 1000 && r.body.pausedMs < 11 * 60000);
  });

  it("finish computes duration as wall time minus pauses, even with sets left undone", async () => {
    await app.col().sessions().updateOne({ id }, { $set: { startedAt: minsAgo(55), pausedMs: 10 * 60000 } });
    const r = await a.call("POST", `/sessions/${id}/finish`, {});
    assert.equal(r.status, 200);
    assert.equal(r.body.status, "completed");
    assert.equal(r.body.durationMin, 45);
    assert.ok(r.body.endedAt);
    assert.equal((await a.call("GET", "/sessions/live")).body.session, null);
  });

  it("a hand save from the Log page keeps the timer data", async () => {
    const s = (await a.call("GET", `/sessions?date=${MON}`)).body[0];
    const body = { date: MON, title: "", exercises: s.exercises.map(({ muscle, ...e }: { muscle: string }) => e), durationMin: s.durationMin, notes: "edited" };
    assert.equal((await a.call("PUT", "/sessions", body)).status, 200);
    const after = (await a.call("GET", `/sessions?date=${MON}`)).body[0];
    assert.equal(after.status, "completed");
    assert.equal(after.startedAt, s.startedAt);
    assert.equal(after.exercises[0].sets[0].rir, 4, "effort survives a save from the Log page");
  });

  it("summary reports sets, duration and a rule-based note", async () => {
    const r = await a.call("GET", `/sessions/${id}/summary`);
    assert.equal(r.status, 200);
    assert.equal(r.body.setsDone, 1);
    assert.equal(r.body.setsPlanned, 5);
    assert.equal(r.body.durationMin, 45);
    assert.match(r.body.ruleNote, /1 of 5 sets/);
    assert.match(r.body.exercises[0].nextTime, /easy/i);
  });

  it("won't start a second workout on a day that already has one", async () => {
    const r = await a.call("POST", "/sessions/start", { date: MON, planDay: "Monday" });
    assert.equal(r.status, 409);
  });

  it("finish with a stale end time uses that time", async () => {
    const r = await a.call("POST", "/sessions/start", { date: "2026-11-18", planDay: "custom" });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.session.exercises, []);
    assert.equal(r.body.session.title, "Empty workout");
    const sid = r.body.session.id;
    await app.col().sessions().updateOne({ id: sid }, { $set: { startedAt: minsAgo(300) } });
    const f = await a.call("POST", `/sessions/${sid}/finish`, { endedAt: minsAgo(240) });
    assert.equal(f.body.durationMin, 60);
  });

  it("discard deletes a live workout", async () => {
    const r = await a.call("POST", "/sessions/start", { date: "2026-11-20", planDay: "custom" });
    assert.equal((await a.call("POST", `/sessions/${r.body.session.id}/discard`)).status, 204);
    assert.equal((await a.call("GET", "/sessions/live")).body.session, null);
    assert.equal((await a.call("GET", "/sessions?date=2026-11-20")).body.length, 0);
  });

  it("another user can't touch the workout", async () => {
    const b = new Browser();
    await signUpVerified(b, { name: "Other", email: "other@example.com" });
    assert.equal((await b.call("POST", `/sessions/${id}/finish`, {})).status, 404);
    assert.equal((await b.call("GET", `/sessions/${id}/summary`)).status, 404);
  });
});

describe("today, progress and exercises", () => {
  const a = new Browser();

  it("today shows the plan day, streak and estimate", async () => {
    await signUpVerified(a, { name: "Dev", email: "dev@example.com" });
    await a.call("POST", "/plans", { name: "Test", text: PLAN });
    const r = await a.call("GET", `/today?date=${MON}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.weekday, "Monday");
    assert.equal(r.body.planDay.exercises.length, 2);
    assert.equal(r.body.estMinutes, 13);
    assert.equal(r.body.streak, 0);
    assert.equal(r.body.weekGoal.done, 0);
    assert.ok(r.body.weekGoal.goal >= 1);
    assert.equal(r.body.weekGoal.days.length, 7);
  });

  it("exercise library lists built-in and the user's own exercises", async () => {
    const r = await a.call("GET", "/exercises");
    assert.ok(r.body.length >= 82);
    const goblet = r.body.find((e: { slug: string }) => e.slug === "goblet-squat");
    assert.equal(goblet.inPlan, true);
    assert.match(goblet.youtubeUrl, /youtube\.com/);
    assert.ok(goblet.image.startsWith("/"));
    const d = await a.call("GET", "/exercises/goblet-squat");
    assert.equal(d.status, 200);
    assert.ok(d.body.alternatives.length > 0);
    assert.ok(d.body.alternatives.every((x: { pattern: string }) => x.pattern === "squat"));
    assert.equal((await a.call("GET", "/exercises/not-a-thing")).status, 404);
  });

  it("progress returns PRs and series after two workouts", async () => {
    const log = (date: string, w: number) =>
      a.call("PUT", "/sessions", {
        date,
        exercises: [{ plannedId: null, name: "Goblet squat", unit: "reps", perSide: false, notes: "", sets: [{ weightKg: w, reps: 10, negatives: null, done: true }] }],
      });
    await log("2026-11-09", 20);
    await log(MON, 24);
    const r = await a.call("GET", `/progress?range=30&date=${MON}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.exercises[0].points.length, 2);
    assert.equal(r.body.prs[0].exercise, "Goblet squat");
    assert.equal(r.body.prs[0].kind, "weight");
    assert.equal(r.body.totals.sessions, 2);
    const t = await a.call("GET", `/today?date=${MON}`);
    // Today (Mon) counts; last Wednesday was a planned day with nothing logged, so the streak stops there.
    assert.equal(t.body.streak, 1);
  });
});
