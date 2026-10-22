import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
export async function siteThemeRegression({ page, origin }) {
  await page.goto(`${origin}/about/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".site").getAttribute("data-site-theme"), "dark");
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  const gear = page.locator('.nav-drawer [data-site-settings]');
  assert.equal(await gear.locator("svg circle").count(), 1, "A conventional settings gear is inside the navigation menu");
  await gear.click();
  await page.getByLabel("全站配色", { exact: true }).selectOption("light");
  await page.getByRole("button", { name: "關閉全站設定", exact: true }).click();
  for (const path of ["/about/", "/journal/", "/resources/", "/", "/work/"]) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".site").getAttribute("data-site-theme"), "light", `Global palette persists at ${path}`);
    if (path === "/work/") {
      await page.waitForFunction(() => document.querySelector("[data-work-lab]")?.dataset.theme === "light");
    } else {
      assert.equal(await page.locator('.nav-drawer [data-site-settings]').count(), 1);
      assert.equal(await page.locator('.header-actions [data-site-settings]').count(), 0);
    }
    {
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const name = path.replaceAll("/", "") || "home";
      await writeFile(`artifacts/accessibility-site-light-${name}.json`, JSON.stringify(axe.violations, null, 2));
      assert.deepEqual(axe.violations.filter(v => ["serious", "critical"].includes(v.impact)), [], `Global light palette stays readable at ${path}`);
      await page.screenshot({ path: `artifacts/site-light-${name}.png` });
    }
  }
  const mobileContext = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const mobile = await mobileContext.newPage();
    await mobile.addInitScript(() => localStorage.setItem("outdesign.site.theme.v1", "light"));
    await mobile.goto(`${origin}/`, { waitUntil: "networkidle" });
    await mobile.waitForFunction(() => document.body.dataset.pageState === "ready");
    const surface = await mobile.locator(".mission-card").evaluate(element => {
      const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
      ctx.fillStyle = getComputedStyle(element).backgroundColor;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    });
    assert.ok(surface.slice(0, 3).every(value => value > 180), "Touch-device glass surfaces follow the light palette instead of a forced dark fallback");
    assert.ok(Number(await mobile.locator(".lunar-backdrop").evaluate(element => getComputedStyle(element).opacity)) < .2, "The light home background does not obscure its dark text");
    const axe = await new AxeBuilder({ page: mobile }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(axe.violations.filter(v => ["serious", "critical"].includes(v.impact)), [], "The light touch layout remains readable");
    await mobile.screenshot({ path: "artifacts/site-light-mobile-home.png", fullPage: true });
  } finally { await mobileContext.close(); }
}
