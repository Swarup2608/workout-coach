import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addDays, trendWeights, weeklyWeightRate } from "../domain.js";

const series = (start: string, kgs: number[], step = 1) => kgs.map((kg, i) => ({ date: addDays(start, i * step), kg }));

describe("trend weight", () => {
  it("starts at the first weigh-in and moves 10% a day toward each new one", () => {
    assert.deepEqual(trendWeights(series("2026-11-01", [80, 81])), [80, 80.1]);
  });

  it("a gap of several days pulls further", () => {
    const t = trendWeights([{ date: "2026-11-01", kg: 80 }, { date: "2026-11-08", kg: 81 }]);
    assert.equal(t[1], 80.52); // 1 − 0.9^7 ≈ 0.52
  });

  it("a one-day spike barely moves the trend", () => {
    const t = trendWeights(series("2026-11-01", [80, 80, 82.5, 80, 80]));
    assert.ok(Math.max(...t) < 80.3);
  });

  it("weekly rate follows a steady loss and ignores noise", () => {
    // −0.5 kg/week with ±0.4 kg daily noise, 35 days.
    const kgs = Array.from({ length: 35 }, (_, i) => 85 - (0.5 / 7) * i + (i % 2 ? 0.4 : -0.4));
    const rate = weeklyWeightRate(series("2026-10-01", kgs))!;
    assert.ok(rate < -0.35 && rate > -0.6, `rate ${rate}`);
  });

  it("needs enough weigh-ins over enough days", () => {
    assert.equal(weeklyWeightRate(series("2026-11-01", [80, 80, 79.8, 79.6])), null);
    assert.equal(weeklyWeightRate(series("2026-11-01", [80, 80, 79.8, 79.6, 79.5, 79.4])), null); // only 5 days
    assert.equal(weeklyWeightRate([]), null);
  });
});
