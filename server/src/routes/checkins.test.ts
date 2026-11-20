import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

const app = useTestApp("checkins_test");

describe("check-ins", () => {
  const a = new Browser();
  const b = new Browser();

  it("returns null when there is no check-in for the date", async () => {
    await signUpVerified(a, { name: "Meera", email: "meera@example.com" });
    const r = await a.call("GET", "/checkins/2026-11-18");
    assert.equal(r.status, 200);
    assert.equal(r.body, null);
  });

  it("saves any single field and returns the rest as null", async () => {
    const r = await a.call("PUT", "/checkins/2026-11-18", { weightKg: 72.5 });
    assert.equal(r.status, 200);
    const got = (await a.call("GET", "/checkins/2026-11-18")).body;
    assert.equal(got.date, "2026-11-18");
    assert.equal(got.weightKg, 72.5);
    assert.equal(got.mood, null);
    assert.equal(got.sleep, null);
    assert.ok(got.updatedAt);
  });

  it("a second save for the same date replaces it (one per day)", async () => {
    await a.call("PUT", "/checkins/2026-11-18", { mood: 4, sleep: "good" });
    const got = (await a.call("GET", "/checkins/2026-11-18")).body;
    assert.deepEqual([got.weightKg, got.mood, got.sleep], [null, 4, "good"]);
    assert.equal(await app.col().checkins().countDocuments({ date: "2026-11-18" }), 1);
  });

  it("soreness, energy and stress give a readiness verdict; history lists the range", async () => {
    const r = await a.call("PUT", "/checkins/2026-11-17", { sleep: "poor", energy: 1, soreness: 5, stress: 5 });
    assert.equal(r.status, 200);
    assert.equal(r.body.readiness.band, "light");
    assert.equal((await a.call("PUT", "/checkins/2026-11-17", { energy: 6 })).status, 400);
    const list = await a.call("GET", "/checkins?from=2026-11-10&to=2026-11-18");
    assert.deepEqual(list.body.map((c: { date: string }) => c.date), ["2026-11-17", "2026-11-18"]);
  });

  it("rejects an empty or invalid check-in", async () => {
    assert.equal((await a.call("PUT", "/checkins/2026-11-18", {})).status, 400);
    assert.equal((await a.call("PUT", "/checkins/2026-11-18", { weightKg: null, mood: null, sleep: null })).status, 400);
    assert.equal((await a.call("PUT", "/checkins/2026-11-18", { mood: 6 })).status, 400);
    assert.equal((await a.call("PUT", "/checkins/2026-11-18", { weightKg: 5 })).status, 400);
    assert.equal((await a.call("PUT", "/checkins/2026-11-18", { sleep: "great" })).status, 400);
  });

  it("rejects malformed and impossible dates", async () => {
    for (const d of ["2026-13-40", "2026-02-30", "today", "2026-1-5"]) {
      assert.equal((await a.call("GET", `/checkins/${d}`)).status, 400, `GET ${d}`);
      assert.equal((await a.call("PUT", `/checkins/${d}`, { mood: 3 })).status, 400, `PUT ${d}`);
    }
  });

  it("keeps check-ins private to each user", async () => {
    await signUpVerified(b, { name: "Kiran", email: "kiran@example.com" });
    assert.equal((await b.call("GET", "/checkins/2026-11-18")).body, null);
  });

  it("account deletion removes check-ins", async () => {
    const id = (await a.call("GET", "/auth/me")).body.user.id;
    assert.equal((await a.call("DELETE", "/auth/me", { password: "Str0ngPassw0rd" })).status, 204);
    assert.equal(await app.col().checkins().countDocuments({ userId: id }), 0);
  });
});
