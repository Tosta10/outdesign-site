import assert from "node:assert/strict";

export async function homeEffectsRegression({ browser, origin }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.effectFrameCount = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => request(time => { window.effectFrameCount++; callback(time); });
  });
  const card = page.locator(".mission-card");
  const hoverCorner = async () => {
    const bounds = await card.boundingBox();
    await page.mouse.move(5, 5);
    await page.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .25);
  };
  const settings = async value => {
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    await page.getByRole("button", { name: "開啟全站設定", exact: true }).click();
    await page.getByLabel("全站動態", { exact: true }).selectOption(value);
    await page.getByRole("button", { name: "關閉全站設定", exact: true }).click();
  };
  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await hoverCorner();
    assert.equal(await card.evaluate(el => el.style.transform), "", "System reduced motion remains the default");
    await settings("full");
    await hoverCorner();
    await page.waitForFunction(() => document.querySelector(".mission-card").style.transform.includes("rotateX"));
    await page.waitForTimeout(1300);
    const frames = await page.evaluate(() => window.effectFrameCount);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.effectFrameCount), frames, "A settled pointer leaves no perpetual effect RAF");
    await page.screenshot({ path: "artifacts/home-tilt-full-motion.png" });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator(".site").getAttribute("data-motion"), "full");
    await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    await page.locator('.nav-drawer [data-lab-settings-open]').click();
    assert.equal(await page.locator('[data-lab-setting="motionPreset"]').inputValue(), "full");
    await page.locator('[data-lab-setting="motionPreset"]').selectOption("reduced");
    await page.goto(origin, { waitUntil: "networkidle" });
    await hoverCorner();
    assert.equal(await card.evaluate(el => el.style.transform), "", "Works-page motion choice carries back to the homepage");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await settings("system");
    assert.equal(await page.locator(".site").getAttribute("data-motion"), "full");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".site").dataset.motion === "reduced");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => document.querySelector(".site").dataset.motion === "full");
    await hoverCorner();
    await page.waitForFunction(() => document.querySelector(".mission-card").style.transform.includes("rotateX"));
  } finally { await context.close(); }
}
