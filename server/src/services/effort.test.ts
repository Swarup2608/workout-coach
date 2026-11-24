import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effortLabel, nextTimeHint } from "../domain.js";

const sets = (...rir: (number | null)[]) => rir.map((r) => ({ done: true, rir: r }));

describe("per-set effort", () => {
  it("labels reps in reserve", () => {
    assert.deepEqual([4, 5, 3, 2, 1, 0, null].map(effortLabel), ["Easy", "Easy", "Good", "Good", "Hard", "Max", null]);
  });

  it("no rated sets → no hint", () => {
    assert.equal(nextTimeHint(sets(null, null)), null);
    assert.equal(nextTimeHint([{ done: false, rir: 4 }]), null);
  });

  it("all easy → add load; timed work → go longer", () => {
    assert.match(nextTimeHint(sets(4, 4, 3))!, /add a little weight/);
    assert.match(nextTimeHint(sets(4), "seconds")!, /longer/);
  });

  it("max before the last set, or very hard on average → hold the weight", () => {
    assert.match(nextTimeHint(sets(0, 1, 1))!, /keep the same weight/);
    assert.match(nextTimeHint(sets(1, 0, 0))!, /keep the same weight/);
  });

  it("hard only on the last set is the right effort", () => {
    assert.match(nextTimeHint(sets(2, 2, 0))!, /one more rep/);
    assert.match(nextTimeHint(sets(2, 1, null))!, /one more rep/);
  });
});
