/**
 * Records docs/workflow/workflow-demo.webm and screenshots in docs/workflow/screens:
 * Today → daily check-in (readiness) → plan week → live workout with timer + rest timer →
 * coach dock (no AI key → prompt) → finish with a warning → summary → exercise library and detail →
 * progress → profile → phone layout.
 *
 * Runs against a throwaway stack (local MongoDB, separate database, no emails):
 *   1. cd server && DEMO_DB=starkfitiq_workflow_demo npx tsx src/scripts/demoServer.ts            # API on :4100
 *   2. cd client && NEXT_DIST_DIR=.next-demo NEXT_PUBLIC_API_URL=http://localhost:4100/api npx next build \
 *        && NEXT_DIST_DIR=.next-demo npx next start -p 3100                                      # web on :3100
 *   3. node docs/workflow/record-demo.mjs
 * The demo user and a few weeks of history are created through the API first, so the video
 * starts on a lived-in Today screen.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:3100";
const API = process.env.DEMO_API ?? "http://localhost:4100/api";
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, "workflow-demo.webm");
const videoDir = path.join(here, ".video-tmp");
const shotsDir = path.join(here, "screens");
fs.mkdirSync(shotsDir, { recursive: true });

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const localDate = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (date, n) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (date) => WEEKDAYS[(new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  colorScheme: "dark",
});
const page = await context.newPage();
const pause = (ms = 900) => page.waitForTimeout(ms);
const step = (name) => console.log(`• ${name}`);
const shot = (name, fullPage = false) => page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage });

// ── 1. Demo user, plan and history via the API (shares cookies with the browser) ──
async function seed() {
  const api = context.request;
  let csrf = "";
  const call = async (method, p, data) => {
    const r = await api.fetch(API + p, { method, data, headers: { origin: BASE, ...(csrf ? { "x-csrf-token": csrf } : {}) } });
    const body = await r.json().catch(() => null);
    if (!r.ok()) throw new Error(`${method} ${p} → ${r.status()} ${JSON.stringify(body)}`);
    if (body?.csrfToken) csrf = body.csrfToken;
    return body;
  };
  await call("POST", "/auth/register", { name: "Asha Rao", email: `asha+${Date.now()}@example.com`, password: "Str0ngPassw0rd", age: 29 });
  await call("PATCH", "/profile/onboarding", { step: 4, answers: { sex: "female", heightCm: 165, startBodyweightKg: 66, targetBodyweightKg: 62, units: "kg" } });
  await call("PATCH", "/profile/onboarding", { step: 5, answers: { goalKey: "fat_loss", experience: "Intermediate", daysPerWeek: 4, sessionMinutes: 60 } });
  await call("PATCH", "/profile/onboarding", { step: 6, answers: { equipmentSetup: "gym", injuries: ["knee"] } });
  await call("PATCH", "/profile/onboarding", { step: 7, answers: { diet: "veg" } });
  const { plan } = await call("PATCH", "/profile/onboarding", { complete: true });

  const today = localDate();
  const training = plan.days.filter((d) => !d.isRest);
  const todayDay = plan.days.find((d) => d.day === weekdayOf(today));
  const startDay = todayDay && !todayDay.isRest ? todayDay : training[0];

  // Three earlier weeks of the same days, getting a little stronger each week (excluding today).
  for (let w = 3; w >= 0; w--) {
    for (const d of training) {
      const date = addDays(today, -7 * w + (WEEKDAYS.indexOf(d.day) - WEEKDAYS.indexOf(weekdayOf(today))));
      if (date >= today) continue;
      await call("PUT", "/sessions", {
        date,
        title: "",
        durationMin: 50 + w * 2,
        sessionRpe: 6 + (w % 3),
        exercises: d.exercises.map((e, i) => ({
          plannedId: e.id,
          name: e.name,
          unit: e.unit,
          perSide: e.perSide,
          notes: "",
          sets: Array.from({ length: e.sets }, () => ({ weightKg: e.unit === "reps" && !/raise|plank|bridge|bird|bug|push-up|pull-up|crunch/i.test(e.name) ? 10 + i * 4 + (3 - w) * 2.5 : null, reps: e.repMin + (3 - w), negatives: null, done: true })),
        })),
        notes: "",
      });
    }
  }
  for (let i = 27; i >= 1; i -= 2) await call("PUT", `/checkins/${addDays(today, -i)}`, { weightKg: Math.round((66 - (27 - i) * 0.07) * 10) / 10, sleep: i % 3 ? "good" : "ok", energy: 3 + (i % 3 ? 1 : 0), soreness: 2 });
  return { startDay };
}

try {
  step("Seed demo user and history");
  const { startDay } = await seed();

  step("Today");
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor({ timeout: 20000 });
  await pause(1800);
  await shot("1-today");

  step("Daily check-in → readiness");
  await page.getByRole("button", { name: "Good", exact: true }).nth(1).click().catch(() => {});
  await page.getByRole("button", { name: /^Energy 4/ }).click();
  await page.getByRole("button", { name: /^Soreness 2/ }).click();
  await page.getByRole("button", { name: /^Stress 2/ }).click();
  await pause(700);
  await shot("2-checkin");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.getByText("Checked in today").waitFor();
  await pause(1600);
  await shot("3-today-ready");

  step("Plan: this week");
  await page.goto(`${BASE}/plan?day=${startDay.day}`);
  await page.getByRole("button", { name: "Start this workout" }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await pause(1500);
  await shot("4-plan-week");

  step("Live workout");
  await page.goto(`${BASE}/workout/live?day=${startDay.day}`);
  await page.getByRole("button", { name: "Finish" }).waitFor({ timeout: 20000 });
  await pause(1500);
  await page.getByRole("button", { name: /Set 1 mark done/ }).click();
  await pause(1500);
  await page.getByRole("button", { name: "15 seconds more rest" }).click();
  await pause(1200);
  await page.getByRole("button", { name: /Set 2 mark done/ }).click();
  await pause(2500);
  await shot("5-live-workout");
  await page.getByRole("button", { name: "Skip" }).click().catch(() => {});
  await pause(800);

  step("Coach dock (no AI key → prompt)");
  await page.getByRole("button", { name: "Ask your coach" }).click();
  await pause(800);
  await page.getByLabel("Message your coach").pressSequentially("This felt too heavy. What now?", { delay: 35 });
  await page.getByRole("dialog", { name: "Coach chat" }).getByRole("button", { name: "Send" }).click();
  await page.getByText("No AI key yet").waitFor({ timeout: 15000 });
  await pause(1800);
  await shot("6-coach-dock");
  await page.keyboard.press("Escape");
  await pause(800);

  step("Finish with sets left → warning");
  await page.getByRole("button", { name: "Finish" }).click();
  await page.getByText(/sets not done. Finish anyway\?/).waitFor();
  await pause(1500);
  await shot("7-finish-warning");
  await page.getByRole("button", { name: "Finish anyway" }).click();

  step("Workout summary");
  await page.getByText(/done$/).first().waitFor({ timeout: 20000 });
  await pause(1500);
  await page.getByRole("button", { name: "Get coach note" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(1500);
  await shot("8-summary");
  await page.mouse.wheel(0, 600);
  await pause(1500);

  step("Exercise library");
  await page.goto(`${BASE}/exercises`);
  await page.getByRole("heading", { name: "Exercises", exact: true }).waitFor();
  await pause(1500);
  await shot("9-exercises");
  await page.getByRole("link", { name: /Glute bridge/ }).first().click();
  await page.getByRole("link", { name: /Watch on YouTube/ }).waitFor({ timeout: 20000 });
  await pause(1500);
  await shot("10-exercise-detail");
  await page.mouse.wheel(0, 700);
  await pause(1500);

  step("Progress");
  await page.goto(`${BASE}/progress`);
  await page.getByRole("heading", { name: "Bodyweight", exact: true }).waitFor({ timeout: 20000 });
  await pause(1500);
  await shot("11-progress", true);
  await page.mouse.wheel(0, 700);
  await pause(1500);

  step("Profile");
  await page.goto(`${BASE}/profile`);
  await page.getByRole("heading", { name: "Workout preferences", exact: true }).waitFor({ timeout: 20000 });
  await pause(1200);
  await shot("12-profile");
  await page.getByRole("link", { name: "Workout preferences" }).click();
  await pause(1500);

  step("Phone layout");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("heading", { name: "Today", exact: true }).waitFor();
  await pause(1500);
  await shot("13-phone-today");
  await page.getByRole("button", { name: /Ask your coach/ }).click();
  await pause(1500);
  await shot("14-phone-coach");
  await pause(800);
} catch (e) {
  await page.screenshot({ path: path.join(here, ".failure.png") }).catch(() => {});
  throw e;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    fs.renameSync(await video.path(), out);
    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`Saved ${path.relative(process.cwd(), out)}`);
  }
}
