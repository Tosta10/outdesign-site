import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

export async function editorialRegression({ browser, origin }) {
  const results = [];
  const errors = [];
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await context.addInitScript(theme => localStorage.setItem("outdesign.site.theme.v1", theme), theme);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    try {
      for (const route of ["", "about", "journal", "resources"]) {
        const name = route || "home";
        await page.goto(`${origin}/${route}${route ? "/" : ""}`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => document.body.dataset.pageState === "ready");
        assert.equal(await page.locator("h1").count(), 1, `One main heading on ${name}`);
        assert.equal(await page.locator("[data-studio-launch]").count(), 1, `One author entrance on ${name}`);
        assert.equal(await page.locator("[data-menu-toggle]").count(), 1, `One navigation control on ${name}`);
        assert.equal(await page.locator("[data-site-settings]").count(), 1, `One settings entrance on ${name}`);
        assert.equal(await page.locator(".editorial-site").getAttribute("data-site-theme"), theme);
        assert.equal(await page.locator(".editorial-site").getAttribute("data-folio-motion"), "reduced");
        assert.equal(await page.locator("[data-folio-reveal]:not([data-revealed=true])").count(), 0,
          "Reduced motion exposes every reading section immediately");
        for (const width of [1440, 1024, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          await page.evaluate(() => new Promise(requestAnimationFrame));
          const layout = await page.evaluate(() => {
            const main = document.querySelector("main").getBoundingClientRect();
            const actions = [...document.querySelectorAll("main a, main summary")].map(element => {
              const box = element.getBoundingClientRect();
              return { text: element.textContent.trim().slice(0, 40), left: box.left, right: box.right, width: box.width };
            });
            return { overflow: document.documentElement.scrollWidth > innerWidth,
              mainWidth: main.width, badActions: actions.filter(box => box.width > 0 && (box.left < -2 || box.right > innerWidth + 2)) };
          });
          assert.equal(layout.overflow, false, `${theme} ${name} fits ${width}px`);
          assert.ok(layout.mainWidth > 0);
          assert.deepEqual(layout.badActions, [], `${theme} ${name} actions stay within ${width}px`);
          results.push({ theme, page: name, width });
          if (width === 1440 || name === "home" && width === 390)
            await page.screenshot({ path: `artifacts/editorial-${theme}-${name}-${width}.png`, fullPage: true });
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        assert.equal(await page.getByRole("button", { name: "開啟選單", exact: true }).count(), 1);
        const menuButton = page.locator("[data-menu-toggle]");
        await menuButton.focus();
        await page.keyboard.press("Enter");
        const menu = page.getByRole("dialog", { name: "網站導覽", exact: true });
        await menu.waitFor();
        assert.equal(await menuButton.getAttribute("aria-expanded"), "true");
        assert.equal(await menu.evaluate(element => element.contains(document.activeElement)), true,
          "Keyboard navigation enters the modal");
        assert.equal(await menu.locator('a[aria-current="page"]').getAttribute("data-page-target"), route || "home");
        await page.keyboard.press("Escape");
        await menu.waitFor({ state: "hidden" });
        await page.waitForFunction(() => document.querySelector("[data-menu-toggle]").getAttribute("aria-expanded") === "false");
        assert.equal(await menuButton.getAttribute("aria-expanded"), "false");
        assert.equal(await menuButton.evaluate(element => document.activeElement === element), true,
          "Closing navigation returns focus to its trigger");
        if (route === "") {
          assert.equal(await page.locator('main a[data-page-target="work"]').count(), 1);
          assert.equal(await page.locator(".featured-card,[data-work-lab]").count(), 0);
        } else if (route === "journal") {
          const first = page.locator(".note-item").first();
          assert.equal(await first.getAttribute("open"), null);
          await first.locator("summary").focus();
          await page.keyboard.press("Enter");
          assert.equal(await first.getAttribute("open"), "");
          assert.equal(await first.locator(".note-body").isVisible(), true);
          assert.ok((await first.locator(".note-body").innerText()).length > 40);
          await page.keyboard.press("Enter");
          assert.equal(await first.getAttribute("open"), null, "The article also closes with the keyboard");
        } else if (route === "resources") {
          assert.equal(await page.locator(".folio-file").count(), 0);
          assert.equal(await page.getByRole("heading", { name: "好用的事物，慢慢整理。", exact: true }).isVisible(), true);
          assert.equal(await page.locator('main a[download],main a[href="#download"]').count(), 0);
        } else if (route === "about") {
          assert.equal(await page.locator('a[href^="mailto:"]').count(), 0,
            "The demonstration email does not create a misleading contact action");
        }
        {
          const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
          await writeFile(`artifacts/accessibility-editorial-${theme}-${name}.json`, JSON.stringify(axe.violations, null, 2));
          assert.deepEqual(axe.violations.filter(issue => ["critical", "serious"].includes(issue.impact)), [],
            `${theme} editorial content remains readable on ${name}`);
        }
      }
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.locator(".folio-work-link").click();
      await page.waitForURL(`${origin}/work/`);
      await page.waitForFunction(() => document.body.dataset.pageState === "ready");
      assert.equal(await page.locator("[data-work-lab]").count(), 1, "The primary entrance opens the real archive");
    } finally { await context.close(); }
  }
  const plain = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  try {
    const page = await plain.newPage();
    for (const route of ["", "about", "journal", "resources"]) {
      await page.goto(`${origin}/${route}${route ? "/" : ""}`, { waitUntil: "load" });
      assert.equal(await page.locator("main h1").isVisible(), true, `Content remains visible without JavaScript on ${route || "home"}`);
      assert.equal(await page.locator("[data-page-loader]").isVisible(), false);
      if (!route) assert.equal(await page.locator(".folio-work-link").getAttribute("href"), "/work/");
      if (route === "journal") {
        await page.locator(".note-item summary").first().click();
        assert.equal(await page.locator(".note-item .note-body").first().isVisible(), true,
          "Native article expansion works without JavaScript");
      }
    }
  } finally { await plain.close(); }
  assert.deepEqual(errors, []);
  await writeFile("artifacts/editorial-regression.json", JSON.stringify({ viewports: results, noJavaScriptPages: 4, runtimeErrors: errors }, null, 2));
}
