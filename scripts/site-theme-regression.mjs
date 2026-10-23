import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
export async function siteThemeRegression({ page, origin }) {
  const paths = ["/about/", "/journal/", "/resources/", "/", "/work/"];
  const results = [];
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on("pageerror", onError);
  const check = async (target, theme, path, mobile = false) => {
    await target.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await target.locator(".site").getAttribute("data-site-theme"), theme,
      `${theme} palette persists at ${path}`);
    if (path === "/work/")
      await target.waitForFunction(theme => document.querySelector("[data-work-lab]")?.dataset.theme === theme, theme);
    else {
      assert.equal(await target.locator('.nav-drawer [data-site-settings]').count(), 1);
      assert.equal(await target.locator('.folio-header [data-site-settings]').count(), 0);
    }
    assert.equal(await target.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
      `${theme} ${path} fits the ${mobile ? "phone" : "desktop"} viewport`);
    const axe = await new AxeBuilder({ page: target }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const name = path.replaceAll("/", "") || "home";
    const prefix = `site-${theme}-${mobile ? "mobile-" : ""}${name}`;
    await writeFile(`artifacts/accessibility-${prefix}.json`, JSON.stringify(axe.violations, null, 2));
    assert.deepEqual(axe.violations.filter(issue => ["serious", "critical"].includes(issue.impact)), [],
      `${theme} ${path} retains readable ${mobile ? "phone" : "desktop"} content`);
    await target.screenshot({ path: `artifacts/${prefix}.png`, fullPage: path !== "/work/" });
    results.push({ theme, page: name, mobile, seriousOrCritical: 0 });
  };
  try {
    for (const theme of ["dark", "light"]) {
      await page.goto(`${origin}/about/`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "開啟選單", exact: true }).click();
      const gear = page.locator('.nav-drawer [data-site-settings]');
      assert.equal(await gear.locator("svg circle").count(), 1,
        "A conventional settings gear is inside the single navigation menu");
      await gear.click();
      await page.getByLabel("全站配色", { exact: true }).selectOption(theme);
      await page.getByRole("button", { name: "關閉全站設定", exact: true }).click();
      for (const path of paths) {
        await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
        await check(page, theme, path);
      }
      const mobileContext = await page.context().browser().newContext({
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce",
      });
      try {
        const mobile = await mobileContext.newPage();
        mobile.on("pageerror", onError);
        await mobile.addInitScript(theme => localStorage.setItem("outdesign.site.theme.v1", theme), theme);
        for (const path of paths) {
          await mobile.goto(`${origin}${path}`, { waitUntil: "networkidle" });
          await check(mobile, theme, path, true);
          if (path === "/") {
            const surface = await mobile.locator(".editorial-site").evaluate(element => {
              const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
              ctx.fillStyle = getComputedStyle(element).backgroundColor;
              ctx.fillRect(0, 0, 1, 1);
              return [...ctx.getImageData(0, 0, 1, 1).data];
            });
            assert.ok(surface.slice(0, 3).every(value => theme === "light" ? value > 180 : value < 80),
              "The touch layout keeps the selected paper or graphite palette");
            assert.equal(await mobile.locator('main a[data-page-target="work"]').count(), 1,
              "Touch devices keep one clear work entrance");
          }
        }
      } finally { await mobileContext.close(); }
    }
    assert.deepEqual(errors, []);
    await writeFile("artifacts/site-theme-results.json", JSON.stringify({ checks: results, runtimeErrors: errors }, null, 2));
  } finally { page.off("pageerror", onError); }
}
