import assert from "node:assert/strict";

export async function homeEffectsRegression({ browser, origin }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.effectFrameCount = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => request(time => { window.effectFrameCount++; callback(time); });
  });
  const art = page.locator("[data-folio-parallax]");
  const settings = async value => {
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    await page.getByRole("button", { name: "開啟全站設定", exact: true }).click();
    await page.getByLabel("全站動態", { exact: true }).selectOption(value);
    await page.getByRole("button", { name: "關閉全站設定", exact: true }).click();
  };
  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "reduced");
    assert.equal(await page.locator("[data-folio-reveal]:not([data-revealed=true])").count(), 0,
      "System reduced motion exposes all content immediately");
    for (const element of await art.all())
      assert.equal(await element.evaluate(node => node.style.getPropertyValue("--folio-parallax-y")), "");
    await settings("full");
    assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "full",
      "An explicit full-motion preference overrides the OS setting");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.waitForFunction(() => document.querySelector(".folio-hero h1").dataset.revealed === "true");
    const lastRow = page.locator(".folio-directory-row").last();
    assert.equal(await lastRow.getAttribute("data-revealed"), null, "Lower reading sections wait for their place in the viewport");
    if (await art.count()) {
      const before = await art.first().evaluate(element => Number.parseFloat(element.style.getPropertyValue("--folio-parallax-y")));
      await page.evaluate(() => scrollTo({ top: 120, behavior: "instant" }));
      await page.waitForFunction(previous => {
        const offset = Number.parseFloat(document.querySelector("[data-folio-parallax]").style.getPropertyValue("--folio-parallax-y"));
        return Number.isFinite(offset) && Math.abs(offset - previous) > 1;
      }, before);
      assert.ok(Math.abs(await art.first().evaluate(element => Number.parseFloat(element.style.getPropertyValue("--folio-parallax-y")))) <= 24,
        "Optional framing stays within the decorative movement budget");
    }
    await lastRow.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".folio-directory-row:last-child").dataset.revealed === "true");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(100);
    assert.equal(await lastRow.getAttribute("data-revealed"), "true", "Reading reveals play once rather than hiding content again");
    const frames = await page.evaluate(() => window.effectFrameCount);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.effectFrameCount), frames, "A settled editorial page leaves no perpetual RAF");
    await page.evaluate(async () => {
      const { suspendRendering } = await import("/src/lib/render-visibility.ts");
      suspendRendering(document.querySelector(".editorial-site"), true);
    });
    assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "paused");
    const pausedFrames = await page.evaluate(() => { dispatchEvent(new Event("scroll")); return window.effectFrameCount; });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.effectFrameCount), pausedFrames,
      "Opening the author surface suspends decorative updates");
    await page.evaluate(async () => {
      const { suspendRendering } = await import("/src/lib/render-visibility.ts");
      suspendRendering(document.querySelector(".editorial-site"), false);
    });
    await page.waitForFunction(() => document.querySelector(".editorial-site").dataset.folioMotion === "full");
    await page.screenshot({ path: "artifacts/home-editorial-full-motion.png", fullPage: true });
    await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    await page.locator('.nav-drawer [data-lab-settings-open]').click();
    assert.equal(await page.locator('[data-lab-setting="motionPreset"]').inputValue(), "full");
    await page.locator('[data-lab-setting="motionPreset"]').selectOption("reduced");
    await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "reduced",
      "The archive's motion preference carries back to editorial pages");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await settings("system");
    assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "full");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".editorial-site").dataset.folioMotion === "reduced");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector(".editorial-site").dataset.folioMotion === "full");
  } finally { await context.close(); }
}
