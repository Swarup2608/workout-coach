// Exports every .ab artboard in banners.html to its data-out path ({feature}/{style}-{w}x{h}.png) in this folder.
// Only writes files; never deletes anything.
// Run from the repo root:  node assets/banners/feature-campaigns/export.cjs
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(dir, "banners.html"), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const fonts = await page.evaluate(() => [400, 600].map((w) => `Uncut Sans ${w}: ${document.fonts.check(`${w} 40px "Uncut Sans"`)}`));
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
  console.log("fonts loaded:", fonts.join(", "));
  console.log("broken images:", broken.length ? [...new Set(broken)] : "none");

  let n = 0;
  for (const el of await page.$$(".ab")) {
    const out = path.join(dir, await el.getAttribute("data-out"));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await el.screenshot({ path: out });
    n++;
  }
  console.log(`exported ${n} banners`);
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
