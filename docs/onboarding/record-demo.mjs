/**
 * Records docs/onboarding/onboarding-demo.webm: sign up → dashboard welcome card → onboarding (8 steps)
 * → "Here's your week" → daily check-in → profile kg/lb setting.
 *
 * Runs against a throwaway stack (no real emails, separate local database):
 *   1. cd server && npx tsx src/scripts/demoServer.ts                      # API on :4100
 *   2. cd client && NEXT_DIST_DIR=.next-demo NEXT_PUBLIC_API_URL=http://localhost:4100/api npx next build \
 *        && NEXT_DIST_DIR=.next-demo npx next start -p 3100                # web on :3100
 *   3. node docs/onboarding/record-demo.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.DEMO_URL ?? "http://localhost:3100";
const here = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(here, "onboarding-demo.webm");
const videoDir = path.join(here, ".video-tmp");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
  colorScheme: "dark",
});
const page = await context.newPage();
const pause = (ms = 900) => page.waitForTimeout(ms);
const step = (name) => console.log(`• ${name}`);
const shotsDir = path.join(here, "screens");
fs.mkdirSync(shotsDir, { recursive: true });
const shot = (name) => page.screenshot({ path: path.join(shotsDir, `${name}.png`) });

async function type(selector, text) {
  await page.locator(selector).click();
  await page.locator(selector).pressSequentially(text, { delay: 45 });
}
const click = async (name, opts = {}) => {
  await page.getByRole("button", { name, exact: opts.exact ?? false }).first().click();
  await pause(opts.wait ?? 700);
};

try {
  step("Sign up");
  await page.goto(`${BASE}/signup`);
  await pause(1200);
  await type("#name", "Asha Rao");
  await type("#email", `asha+${Date.now()}@example.com`);
  await type("#age", "29");
  await type("#password", "Str0ngPassw0rd");
  await type("#confirm", "Str0ngPassw0rd");
  await pause(500);
  await click("Create account", { wait: 0 });

  step("Dashboard welcome card");
  await page.getByText("Welcome, Asha").waitFor({ timeout: 20000 });
  await pause(1200);
  await shot("1-dashboard-welcome");
  await pause(1000);
  await page.getByRole("link", { name: "Continue setup" }).click();

  step("Onboarding: goal");
  await page.getByText("What's your main goal?").waitFor();
  await pause(1500);
  await shot("2-goal");
  await click("Muscle gain / weight gain");
  await click("Continue", { exact: true, wait: 1000 });

  step("Onboarding: body (switch to lb)");
  await page.getByText("About your body").waitFor();
  await click("lb", { exact: true });
  await click("Male", { exact: true });
  await type("#ob-height", "175");
  await type("#ob-weight", "172");
  await type("#ob-target", "180");
  await pause(600);
  await shot("3-body-lb");
  await click("Continue", { exact: true, wait: 1000 });

  step("Onboarding: training");
  await page.getByText("How do you train?").waitFor();
  await click("Intermediate");
  await page.getByRole("button", { name: "4 days" }).click();
  await pause(400);
  await page.getByRole("button", { name: "60 minutes" }).click();
  await pause(600);
  await click("Continue", { exact: true, wait: 1000 });

  step("Onboarding: equipment & injuries");
  await page.getByText("Equipment and limits").waitFor();
  await click("Full gym");
  await click("Knee", { exact: true });
  await pause(600);
  await click("Continue", { exact: true, wait: 1000 });

  step("Onboarding: diet (skipped → red)");
  await page.getByText("How do you eat?").waitFor();
  await pause(800);
  await click("Skip", { exact: true, wait: 1200 });

  step("Onboarding: AI coach (optional)");
  await page.getByText("AI coach (optional)").waitFor();
  await pause(800);
  await shot("4-ai-coach-diet-skipped");
  await pause(700);
  await click("Finish and see my plan", { wait: 0 });

  step("Plan reveal");
  await page.getByText("Here's your week").waitFor({ timeout: 20000 });
  await pause(800);
  await page.screenshot({ path: path.join(shotsDir, "5-plan-reveal.png"), fullPage: true });
  await pause(1000);
  await page.mouse.wheel(0, 500);
  await pause(1500);
  await page.mouse.wheel(0, 700);
  await pause(1500);
  await page.getByRole("link", { name: "Start using StarkFitIQ" }).click();

  step("Daily check-in");
  await page.getByText("How are you today?").waitFor({ timeout: 20000 });
  await pause(800);
  await shot("6-daily-checkin");
  await pause(700);
  await type("#ci-weight", "172.4");
  await page.getByRole("button", { name: "Good", exact: true }).first().click();
  await pause(500);
  await page.getByRole("button", { name: "Good", exact: true }).nth(1).click();
  await pause(700);
  await click("Save check-in", { wait: 0 });
  await page.getByText("Checked in today ✓").waitFor();
  await pause(2000);

  step("Profile: units and Redo setup");
  await page.goto(`${BASE}/profile`);
  await page.getByText("Weight unit").waitFor();
  await pause(2500);
  console.log("Done");
} catch (e) {
  await page.screenshot({ path: path.join(here, "record-demo-failure.png"), fullPage: true });
  console.error("Recording failed; see docs/onboarding/record-demo-failure.png");
  throw e;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  if (video) {
    fs.renameSync(await video.path(), out);
    console.log(`Saved ${path.relative(process.cwd(), out)}`);
  }
  fs.rmSync(videoDir, { recursive: true, force: true });
}
