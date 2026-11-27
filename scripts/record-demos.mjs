// Records the product demos and page screenshots.
//
// Usage: npm run dev (both servers), then:
//   node scripts/record-demos.mjs            # everything
//   node scripts/record-demos.mjs e2e shots  # docs/demo/e2e-workflow.mp4 + docs/screenshots/**
//
// The e2e run signs up a fresh demo-<timestamp>@example.com account and marks it verified directly in the
// database (dev only; refuses any other address). Screenshots of signed-in pages reuse that account, so run
// "e2e" before "shots". Needs ffmpeg on PATH for mp4 output (otherwise the .webm is kept).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.APP_URL || "http://localhost:3000";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEMO = path.join(ROOT, "docs/demo");
const SHOTS = path.join(ROOT, "docs/screenshots");
const RAW = path.join(DEMO, ".raw");
const STATE = path.join(ROOT, "scripts/.demo-state.json"); // login of the last e2e account (gitignored)
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const PASSWORD = "DemoPass2026";

const which = process.argv.slice(2);
const want = (k) => which.length === 0 || which.includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ helpers */

/** Visible cursor + caption bar, injected into every page of a recording (headless video has no cursor). */
const OVERLAY = () => {
  const install = () => {
    if (document.getElementById("__demo-cursor")) return;
    const c = document.createElement("div");
    c.id = "__demo-cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(212,180,131,.35);border:2px solid #d4b483;z-index:2147483647;pointer-events:none;transition:transform .12s ease;transform:translate(-100px,-100px)";
    document.documentElement.appendChild(c);
    document.addEventListener("mousemove", (e) => (c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`), true);
    document.addEventListener("mousedown", () => (c.style.background = "rgba(212,180,131,.8)"), true);
    document.addEventListener("mouseup", () => (c.style.background = "rgba(212,180,131,.35)"), true);
    const cap = document.createElement("div");
    cap.id = "__demo-cap";
    cap.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;pointer-events:none;padding:10px 18px;border-radius:999px;background:rgba(14,14,15,.88);border:1px solid rgba(212,180,131,.5);color:#ede9e1;font:500 15px/1.3 'Uncut Sans',system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 12px 40px -12px rgba(0,0,0,.8);opacity:0;transition:opacity .3s ease";
    document.documentElement.appendChild(cap);
    const saved = sessionStorage.getItem("__demo-cap");
    if (saved) {
      cap.textContent = saved;
      cap.style.opacity = "1";
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

async function caption(p, text) {
  await p.evaluate((t) => {
    sessionStorage.setItem("__demo-cap", t);
    const cap = document.getElementById("__demo-cap");
    if (!cap) return;
    cap.textContent = t;
    cap.style.opacity = t ? "1" : "0";
  }, text);
}

/** Moves the visible cursor to the element, then clicks it. */
async function click(p, target, { pause = 350 } = {}) {
  const loc = typeof target === "string" ? p.locator(target).first() : target;
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (b) {
    await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 18 });
    await sleep(160);
  }
  await loc.click();
  await sleep(pause);
}

async function type(p, target, text) {
  const loc = typeof target === "string" ? p.locator(target).first() : target;
  await click(p, loc, { pause: 100 });
  await loc.fill("");
  await loc.pressSequentially(String(text), { delay: 45 });
  await sleep(150);
}

/** Smooth wheel scroll until `sel` reaches the top area of the viewport (or the page ends). */
async function scrollTo(p, sel, { offset = 90, step = 60, tick = 30 } = {}) {
  for (let i = 0; i < 400; i++) {
    const top = await p.evaluate((s) => document.querySelector(s)?.getBoundingClientRect().top ?? null, sel);
    if (top == null || top <= offset) return;
    const atEnd = await p.evaluate(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2);
    if (atEnd) return;
    await p.mouse.wheel(0, Math.min(step, Math.max(12, top - offset)));
    await sleep(tick);
  }
}

async function scrollBy(p, px, { step = 60, tick = 30 } = {}) {
  for (let done = 0; done < px; done += step) {
    await p.mouse.wheel(0, step);
    await sleep(tick);
  }
}

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** Saves the context's recording as docs/demo/<name>.mp4 (or .webm without ffmpeg). */
async function saveVideo(page, ctx, name) {
  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  if (hasFfmpeg) {
    const out = path.join(DEMO, `${name}.mp4`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
    fs.rmSync(webm);
    console.log("✓", path.relative(ROOT, out));
  } else {
    const out = path.join(DEMO, `${name}.webm`);
    fs.renameSync(webm, out);
    console.log("✓", path.relative(ROOT, out), "(install ffmpeg for mp4)");
  }
}

/** Dev-only: marks one demo-*@example.com account verified, so the demo can skip the inbox. */
async function verifyDemoAccount(email) {
  if (!/^demo-[\w-]+@example\.com$/.test(email)) throw new Error(`refusing to verify ${email}`);
  const env = Object.fromEntries(
    fs
      .readFileSync(path.join(ROOT, "server/.env"), "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")])
  );
  const { MongoClient } = createRequire(path.join(ROOT, "server/package.json"))("mongodb");
  const client = await MongoClient.connect(env.MONGODB_URI);
  try {
    await client.db(env.MONGODB_DB).collection("users").updateOne({ email }, { $set: { emailVerified: true } });
  } finally {
    await client.close();
  }
}

/* --------------------------------------------- "with your own AI key" simulation
   The demo account has no AI key. For the closing segment the recording browser answers the AI endpoints
   itself (status, key settings, coach chat, coach note) so viewers see how the coach works with a key.
   Nothing is sent to the server or saved for these calls. */
const COACH_REPLY =
  "Solid start, Alex. You checked in feeling good (energy 4/5, low soreness) and got your first Upper body session in.\n\n" +
  "**What went well**\n- Bench press at 60 kg moved cleanly for all 6 reps.\n- You logged food and 2 glasses of water: keep that habit going.\n\n" +
  "**Next session**\n- Keep bench at 60 kg and aim for the top of the 3–6 range on every set before adding 2.5 kg.\n- Finish all planned sets on rows and presses; 23 sets were left undone today.\n- Friday is Lower body: sleep 7+ hours tonight so you go in fresh.";
const COACH_NOTE =
  "Good first session. Bench press at 60 kg for 6 reps was steady, so stay there next time and get every set to 6 before going up. " +
  "You stopped early on rows and presses; finishing those is the quickest win for your weekly score.";

async function simulateAiKey(page) {
  const chat = [];
  const now = () => new Date().toISOString();
  await page.route("**/api/status", (r) => r.fulfill({ json: { aiConnected: true, provider: "anthropic", model: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" } }));
  await page.route("**/api/settings/ai", (r) =>
    r.request().method() === "GET"
      ? r.fulfill({ json: { configured: true, provider: "anthropic", model: "claude-sonnet-5-5", baseUrl: null, keyHint: "sk-ant-…a1F9", updatedAt: now() } })
      : r.fallback()
  );
  await page.route("**/api/sessions/*/coach-note", (r) => r.fulfill({ json: { note: { text: COACH_NOTE, source: "ai", createdAt: now() }, prompt: null } }));
  await page.route("**/api/chat", async (r) => {
    const m = r.request().method();
    if (m === "GET") return r.fulfill({ json: chat });
    if (m === "DELETE") {
      chat.length = 0;
      return r.fulfill({ status: 204, body: "" });
    }
    const { message } = r.request().postDataJSON();
    chat.push({ id: `u${chat.length}`, role: "user", content: message, createdAt: now() });
    const words = COACH_REPLY.split(/(?<=\s)/);
    const reply = { id: `a${chat.length}`, role: "assistant", content: COACH_REPLY, createdAt: now() };
    chat.push(reply);
    const body = words.map((w) => `event: delta\ndata: ${JSON.stringify(w)}\n\n`).join("") + `event: done\ndata: ${JSON.stringify(reply)}\n\n`;
    return r.fulfill({ status: 200, headers: { "Content-Type": "text/event-stream" }, body });
  });
}

/* ------------------------------------------------------------------- e2e demo */

async function recordE2E(browser) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const email = `demo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}@example.com`;
  console.log("e2e account:", email);

  const ctx = await browser.newContext({ viewport: DESKTOP, colorScheme: "dark", recordVideo: { dir: RAW, size: DESKTOP } });
  await ctx.addInitScript(OVERLAY);
  const p = await ctx.newPage();
  // Stills of the flow, without the demo cursor and caption
  const shot = async (name) => {
    await p.evaluate(() => document.querySelectorAll("#__demo-cursor,#__demo-cap").forEach((e) => (e.style.visibility = "hidden")));
    await p.screenshot({ path: path.join(SHOTS, "desktop", `${name.replace(/^app-/, "flow-")}.png`) });
    await p.evaluate(() => document.querySelectorAll("#__demo-cursor,#__demo-cap").forEach((e) => (e.style.visibility = "")));
  };
  /** Optional step: logged and skipped if the UI isn't there, so one miss doesn't lose the recording. */
  const soft = (label, fn) => fn().catch((e) => console.log(`  skipped ${label}: ${e.message.split("\n")[0]}`));

  // 1. Home → sign up
  await p.goto(BASE + "/", { waitUntil: "load" });
  await caption(p, "StarkFitIQ: plan your week, log every set, get coached");
  await sleep(3000);
  await click(p, '.site-nav a:has-text("Start free")', { pause: 1500 });
  await caption(p, "1 · Create an account");
  await type(p, "#name", "Alex Demo");
  await type(p, "#email", email);
  await type(p, "#age", "29");
  await type(p, "#password", PASSWORD);
  await type(p, "#confirm", PASSWORD);
  await click(p, 'button:has-text("Create account")', { pause: 2500 });

  // 2. Email verification (link clicked off-camera)
  await caption(p, "2 · Verify your email");
  await sleep(2000);
  await verifyDemoAccount(email);
  await click(p, `button:has-text("I've verified")`, { pause: 2500 });

  // 3. Onboarding
  await caption(p, "3 · Set up: a few questions build your plan");
  await sleep(1500);
  await click(p, 'a:has-text("Continue setup")', { pause: 2000 });
  const next = () => click(p, 'button:has-text("Continue")', { pause: 1300 });
  await click(p, "text=Get stronger");
  await next();
  await click(p, 'button:has-text("Male")');
  await type(p, "#ob-height", "178");
  await type(p, "#ob-weight", "78");
  await type(p, "#ob-target", "75");
  await next();
  await click(p, "text=Intermediate");
  await click(p, 'button[aria-label="4 days"]');
  await click(p, 'button[aria-label="60 minutes"]');
  await next();
  await click(p, "text=Full gym");
  await click(p, 'button:has-text("Lower back")');
  await next();
  await click(p, "text=Non-vegetarian");
  await next();
  await caption(p, "AI coach is optional: add your own key now or later");
  await sleep(2500);
  await click(p, 'button:has-text("Finish and see my plan")', { pause: 2500 });
  await caption(p, "Your starter plan, built from your answers");
  await shot("app-04-plan-reveal");
  await scrollBy(p, 500);
  await sleep(1500);
  await click(p, 'a:has-text("Start using StarkFitIQ")', { pause: 2500 });

  // 4. Daily check-in
  await caption(p, "4 · Daily check-in sets today's readiness");
  const dlg = p.locator("dialog[open]");
  await dlg.waitFor({ timeout: 10000 });
  await type(p, dlg.locator("input[type=number]"), "78");
  const good = dlg.getByRole("button", { name: "Good", exact: true }); // mood (icon) then sleep (text)
  await click(p, good.nth(0));
  await click(p, good.nth(1));
  await click(p, '[aria-label="Energy 4 of 5"]');
  await click(p, '[aria-label="Soreness 2 of 5"]');
  await click(p, '[aria-label="Stress 2 of 5"]');
  await shot("app-05-check-in");
  await click(p, dlg.locator('button:has-text("Save check-in")'), { pause: 2500 });
  await caption(p, "Today: readiness, today's workout and the weekly goal");
  await shot("app-06-dashboard");
  await scrollBy(p, 900, { step: 40 });
  await sleep(1200);
  await soft("show check-in text", () => click(p, 'button:has-text("Show text")', { pause: 1800 }));
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(1200);

  // 5. Plan
  await caption(p, "5 · Your week: open any day, reshuffle missed sessions");
  await click(p, 'aside a:has-text("Plan")', { pause: 2500 });
  await click(p, p.locator("button", { hasText: "Today" }).filter({ hasText: "THU" }).first(), { pause: 1800 }).catch(() => {});
  await click(p, 'button:has-text("Reshuffle this week")', { pause: 2500 }).catch(() => {});
  await shot("app-07-plan");
  await p.keyboard.press("Escape");
  await sleep(800);

  // 6. Live workout
  await caption(p, "6 · Live workout: weights, reps, rest timer");
  await click(p, 'aside a:has-text("Today")', { pause: 2500 });
  await click(p, 'a:has-text("Start workout")', { pause: 2500 });
  await click(p, 'button:has-text("Start Upper body")', { pause: 2500 }).catch(() => {});
  const kg = p.locator('input[placeholder="BW"]');
  const reps = p.locator('input[placeholder="6"]');
  const tick = p.locator('button:has-text("✓")');
  for (let i = 0; i < 3; i++) {
    await type(p, kg.nth(i), "60");
    await type(p, reps.nth(i), "6");
    await click(p, tick.nth(i), { pause: 900 });
  }
  await shot("app-08-live-workout");
  await click(p, 'button:has-text("Next →")', { pause: 1800 });
  await type(p, kg.nth(0), "50");
  await click(p, tick.nth(0), { pause: 1200 });
  await caption(p, "Ask the coach mid-workout: it sees your plan and today's sets");
  await soft("coach dock", () => click(p, 'button[aria-label="Ask your coach"], button:has-text("Ask your coach")', { pause: 2500 }));
  await shot("app-09-coach-dock");
  await p.keyboard.press("Escape");
  await sleep(800);
  await caption(p, "Finish: unfinished sets are flagged before saving");
  await click(p, 'button:has-text("Finish")', { pause: 1800 });
  await shot("app-10-finish-warning");
  await click(p, 'button:has-text("Finish anyway")', { pause: 3000 });

  // 7. Summary
  await caption(p, "7 · Summary: vs last time, effort and notes");
  await shot("app-11-summary");
  const summaryUrl = p.url();
  await click(p, 'button:has-text("7")', { pause: 600 }).catch(() => {});
  await type(p, "#notes", "Bench felt strong. Short on time for rows.").catch(() => {});
  await click(p, 'button:has-text("Save")', { pause: 1500 }).catch(() => {});
  await caption(p, "No AI key? Coach notes come as a ready-made prompt to paste into Claude");
  await click(p, 'button:has-text("Get coach note")', { pause: 2500 });
  await scrollBy(p, 400);
  await sleep(1500);

  // 8. Exercises
  await caption(p, "8 · Exercise library: filtered to your equipment and injuries");
  await click(p, 'aside a:has-text("Exercises")', { pause: 2500 });
  await type(p, 'input[placeholder="Search…"]', "squat");
  await sleep(1200);
  await shot("app-12-exercises");
  await click(p, 'main a[href^="/exercises/"]', { pause: 2500 }); // first match (the list honours your injuries)
  await caption(p, "Every exercise: steps, form cues and a video");
  await shot("app-13-exercise-detail");
  await scrollBy(p, 600);
  await sleep(1200);

  // 9. Nutrition
  await caption(p, "9 · Nutrition: water, meals and suggestions for right now");
  await click(p, 'aside a:has-text("Nutrition")', { pause: 2500 });
  await click(p, 'button:has-text("Glass (250 ml)")', { pause: 700 });
  await click(p, 'button:has-text("Glass (250 ml)")', { pause: 900 });
  await soft("suggested breakfast", () => click(p, 'button:has-text("Add to breakfast") >> nth=0', { pause: 1800 }));
  await shot("app-14-nutrition");
  await caption(p, "Search the food library or quick-add your own meal");
  await click(p, 'a:has-text("Add to lunch")', { pause: 2500 });
  await type(p, 'input[placeholder^="Search foods"]', "paneer");
  await sleep(1500);
  await shot("app-15-add-food");
  await soft("quick add food", async () => {
    await p.locator('input[placeholder^="Search foods"]').fill(""); // search results hide the tabs
    await sleep(800);
    await click(p, p.locator("button").filter({ hasText: /^\s*Quick add\s*$/ }), { pause: 1000 });
    await type(p, "#qa-name", "Office canteen thali");
    await type(p, "#m-kcal", "650");
    await type(p, "#m-proteinG", "28");
    await click(p, p.locator("button").filter({ hasText: /^\s*Add\s*$/ }).last(), { pause: 1500 });
  });
  await click(p, 'a:has-text("Done")', { pause: 2000 });
  await caption(p, "A whole day of meals, planned to your targets");
  await click(p, 'a:has-text("Plan the whole day")', { pause: 2500 });
  await soft("swap meal", () => click(p, 'button:has-text("Swap") >> nth=0', { pause: 1200 }));
  await soft("log dinner", () => click(p, 'button:has-text("Log dinner")', { pause: 1500 }));
  await shot("app-16-meal-plan");

  // 10. Log, progress, history
  await caption(p, "10 · Workout log: any day by hand, or paste a day in plain words");
  await click(p, 'aside a:has-text("Workout Log")', { pause: 2500 });
  await click(p, "summary:has-text('Quick add with AI')", { pause: 1500 }).catch(() => {});
  await shot("app-17-log");
  await scrollBy(p, 700);
  await sleep(1200);
  await caption(p, "Progress: bodyweight, strength and personal records");
  await click(p, 'aside a:has-text("Progress")', { pause: 2500 });
  await shot("app-18-progress");
  await scrollBy(p, 700);
  await sleep(1500);

  // 11. Profile + AI key form
  await caption(p, "11 · Profile: training preferences, limits and your AI key");
  await click(p, 'aside a:has-text("Profile")', { pause: 2500 });
  await click(p, 'button:has-text("Workout preferences")', { pause: 1500 }).catch(() => {});
  await click(p, 'button:has-text("AI coach")', { pause: 2000 }).catch(() => {});
  await shot("app-19-profile-ai");

  // 12. With an AI key (simulated in this browser only; see simulateAiKey)
  await caption(p, "12 · With your own AI key: Claude, OpenAI, Gemini and more");
  await simulateAiKey(p);
  await p.reload({ waitUntil: "load" });
  await sleep(2000);
  await click(p, 'button:has-text("AI coach")', { pause: 2000 }).catch(() => {});
  await caption(p, "The coach answers from your plan, check-ins, workouts and food");
  await click(p, 'aside a:has-text("AI Coach")', { pause: 2500 });
  await click(p, 'button:has-text("How did my week go?")', { pause: 600 });
  await click(p, 'button:has-text("Send")', { pause: 4500 }).catch(() => {});
  await shot("app-20-coach-chat");
  await caption(p, "…and writes a coach note after every workout");
  await p.goto(summaryUrl, { waitUntil: "load" });
  await sleep(2000);
  await click(p, 'button:has-text("Get coach note")', { pause: 3000 }).catch(() => {});
  await caption(p, "StarkFitIQ: train like you engineered it.");
  await click(p, 'a:has-text("Back to Today")', { pause: 3500 });

  await ctx.storageState({ path: STATE });
  await saveVideo(p, ctx, "e2e-workflow");
}

/* ---------------------------------------------------------------- screenshots */

const PUBLIC = [
  ["/login", "login"],
  ["/signup", "signup"],
  ["/forgot-password", "forgot-password"],
];
const APP = [
  ["/dashboard", "dashboard"],
  ["/checkin", "check-in"],
  ["/plan", "plan"],
  ["/workout/live", "start-workout"],
  ["/nutrition", "nutrition"],
  ["/nutrition/add", "add-food"],
  ["/nutrition/plan", "meal-plan"],
  ["/log", "log"],
  ["/history", "history"],
  ["/progress", "progress"],
  ["/exercises", "exercises"],
  ["/exercises/barbell-back-squat", "exercise-detail"],
  ["/chat", "coach-chat"],
  ["/profile", "profile"],
];

async function captureSet(browser, { viewport, folder, mobile }) {
  const dir = path.join(SHOTS, folder);
  fs.mkdirSync(dir, { recursive: true });
  const opts = { viewport, colorScheme: "dark", ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) };

  const pub = await browser.newContext(opts);
  const p = await pub.newPage();
  for (const [url, name] of PUBLIC) {
    await p.goto(BASE + url, { waitUntil: "load" });
    await sleep(3000);
    await p.screenshot({ path: path.join(dir, `public-${name}.png`), fullPage: true });
  }
  await pub.close();

  if (!fs.existsSync(STATE)) return console.log("  (no e2e account yet: skipped signed-in pages; run with e2e first)");
  const app = await browser.newContext({ ...opts, storageState: STATE });
  const q = await app.newPage();
  for (const [url, name] of APP) {
    await q.goto(BASE + url, { waitUntil: "load" });
    await sleep(2500);
    await q.keyboard.press("Escape"); // close the daily check-in dialog if it opens
    await q.screenshot({ path: path.join(dir, `app-${name}.png`), fullPage: true });
  }
  await app.close();
}

/* ----------------------------------------------------------------------- run */

fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(path.join(SHOTS, "desktop"), { recursive: true });
const browser = await chromium.launch();
try {
  if (want("e2e")) await recordE2E(browser);
  if (want("shots")) {
    await captureSet(browser, { viewport: DESKTOP, folder: "desktop" });
    await captureSet(browser, { viewport: PHONE, folder: "mobile", mobile: true });
    console.log("✓", path.relative(ROOT, SHOTS));
  }
} finally {
  await browser.close();
  fs.rmSync(RAW, { recursive: true, force: true });
}
