import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
export async function siteThemeRegression({ page, origin }) {
  await page.goto(`${origin}/about/`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".site").getAttribute("data-site-theme"), "dark");
  const gear = page.locator('.header-actions [data-site-settings]');
  assert.equal(await gear.locator("svg circle").count(), 2, "A flat two-ring gear is available in site navigation");
  await gear.click();
  await page.getByLabel("全站配色", { exact: true }).selectOption("light");
  await page.getByRole("button", { name: "關閉全站設定", exact: true }).click();
  for (const path of ["/about/", "/journal/", "/resources/", "/", "/work/"]) {
    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".site").getAttribute("data-site-theme"), "light", `Global palette persists at ${path}`);
    if (path === "/work/") {
      await page.waitForFunction(() => document.querySelector("[data-work-lab]")?.dataset.theme === "light");
    } else {
      assert.equal(await page.locator('.header-actions [data-site-settings]').count(), 1);
    }
    {
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const name = path.replaceAll("/", "") || "home";
      await writeFile(`artifacts/accessibility-site-light-${name}.json`, JSON.stringify(axe.violations, null, 2));
      assert.deepEqual(axe.violations.filter(v => ["serious", "critical"].includes(v.impact)), [], `Global light palette stays readable at ${path}`);
      await page.screenshot({ path: `artifacts/site-light-${name}.png` });
    }
  }
}
