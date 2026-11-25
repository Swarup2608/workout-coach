// Exports every .ab artboard in banners.html to {id}.png (exact pixel size) in this folder.
// Run from the repo root:  node assets/banners/plan-log-score/export.cjs
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto("file://" + path.join(dir, "banners.html"), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const fonts = await page.evaluate(() => [400, 600].map((w) => `Uncut Sans ${w}: ${document.fonts.check(`${w} 40px "Uncut Sans"`)}`));
  const broken = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")));
  console.log("fonts loaded:", fonts.join(", "));
  console.log("broken images:", broken.length ? broken : "none");

  for (const el of await page.$$(".ab")) {
    const id = await el.getAttribute("id");
    await el.screenshot({ path: path.join(dir, `${id}.png`) });
    console.log("exported", `${id}.png`);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
