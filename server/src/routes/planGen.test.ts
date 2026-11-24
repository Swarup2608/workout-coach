import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Browser, signUpVerified, useTestApp } from "../test/harness.js";

const app = useTestApp("plangen_test");

describe("plan generator API", () => {
  const a = new Browser();

  it("needs setup answers first", async () => {
    await signUpVerified(a, { name: "Arjun", email: "arjun@example.com" });
    const r = await a.call("POST", "/plans/generate", {});
    assert.equal(r.status, 422);
    assert.equal(r.body.code, "setup");
  });

  it("without an AI key: 409 on generate, a prompt to paste instead", async () => {
    const id = (await a.call("GET", "/auth/me")).body.user.id;
    await app.col().profiles().updateOne(
      { _id: id },
      { $set: { goalKey: "strength", experience: "Intermediate", daysPerWeek: 4, sessionMinutes: 60, equipmentSetup: "gym", injuries: ["knee"] } },
      { upsert: true },
    );
    const r = await a.call("POST", "/plans/generate", { notes: "bigger arms" });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, "no_ai");
    const p = await a.call("POST", "/plans/generate/prompt", { notes: "bigger arms" });
    assert.equal(p.status, 200);
    assert.match(p.body.text, /Exactly 4 training days/);
    assert.match(p.body.text, /bigger arms/);
    assert.match(p.body.text, /Injuries: knee/);
  });

  it("checks a pasted plan and previews it without saving", async () => {
    const before = (await a.call("GET", "/plans")).body.length;
    const r = await a.call("POST", "/plans/generate/check", { text: "## Monday — Arms\n- Bosu ball juggling — 3 × 10\n- Hammer curl — 3 × 10" });
    assert.equal(r.status, 200);
    assert.equal(r.body.source, "pasted");
    assert.ok(r.body.problems.some((x: string) => /exactly 4/.test(x)));
    assert.equal((await a.call("GET", "/plans")).body.length, before, "nothing saved");
    assert.equal((await a.call("POST", "/plans/generate/check", { text: "hello there" })).status, 422);
    assert.equal((await a.call("POST", "/plans/generate", { notes: "x".repeat(501) })).status, 400);
  });
});
