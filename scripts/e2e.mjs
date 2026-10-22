import { siteThemeRegression } from "./site-theme-regression.mjs";
import { pageLoadingRegression } from "./page-loading-regression.mjs";
import { workLabAuthorRegression } from "./work-lab-author-regression.mjs";
import { workLabTrackingRegression } from "./work-lab-tracking-regression.mjs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createPortProbe } from "node:net";
import assert from "node:assert/strict";
import { workLabRegression } from "./work-lab-regression.mjs";
import { studioRegression } from "./studio-regression.mjs";
import { startLocalApi } from "../server/local-api.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdesign-browser-"));
const probe = createPortProbe();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const api = await startLocalApi({
  directory,
  port: 0,
  allowedOrigins: [origin],
});
const astro = JSON.parse(
  await readFile("node_modules/astro/package.json", "utf8"),
);
const child = spawn(
  process.execPath,
  [
    join("node_modules/astro", astro.bin.astro),
    "dev",
    "--ignore-lock",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      PUBLIC_API_URL: api.url + "/api",
      SITE_URL: origin,
      BASE_PATH: "/",
      CONTENT_VERSION: "",
      CONTENT_REQUIRED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (c) => {
  output += c;
});
child.stderr.on("data", (c) => {
  output += c;
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready)
    throw new Error("Preview server did not start: " + output.slice(-3000));
  await mkdir("artifacts", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: process.env.OUTDESIGN_TEST_SOFTWARE_GPU === "true"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
      : [],
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const settleCanvas = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".editor-shell")?.dataset.previewPending !==
        "true",
    );
  page.on("dialog", async (dialog) => {
    console.log("Browser dialog:", dialog.type(), dialog.message());
    await dialog.dismiss();
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error("Browser console:", message.text());
    if (
      message.type() === "error" &&
      /THREE|shader|WebGLProgram/i.test(message.text())
    )
      errors.push(message.text());
  });
  page.on("request", (req) => requests.push(req.url()));
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "OutDesign");
  assert.equal(
    requests.some((u) => /bootstrap|Studio\.tsx|react-dom/.test(u)),
    false,
    "Editor must not load for visitors",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".mission-card").scrollIntoViewIfNeeded();
  const optical = await page.locator(".mission-card").boundingBox();
  await page
    .locator(".mission-card")
    .hover({ position: { x: optical.width * 0.25, y: optical.height * 0.25 } });
  await page.waitForFunction(() =>
    document.querySelector(".mission-card").style.transform.includes("rotateX"),
  );
  await page.mouse.move(0, 0);
  await page.waitForFunction(
    () => document.querySelector(".mission-card").style.transform === "",
  );
  assert.equal(
    await page.locator("[data-studio-launch]").count(),
    1,
    "One author entry per page",
  );
  assert.equal(
    await page.locator(".brand-mark").getAttribute("src"),
    "/assets/outdesign-mark.webp",
  );
  assert.equal(
    await page.locator(".hero-atmosphere,.bubble-panel,.ripple-canvas").count(),
    0,
    "Original homepage panels stay intact without extra effects",
  );
  assert.equal(
    requests.some((url) => /src\/lib\/surfaces|node_modules.*three/.test(url)),
    false,
    "Original homepage does not load optional WebGL",
  );
  assert.equal(
    await page.locator(".mission-card h2").textContent(),
    "保持好奇，\n慢慢做出喜歡的事。",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(
    optical.x + optical.width * 0.25,
    optical.y + optical.height * 0.25,
  );
  assert.equal(
    await page.locator(".mission-card").evaluate((el) => el.style.transform),
    "",
  );
  await page.mouse.move(0, 0);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "artifacts/home-desktop.png", fullPage: true });
  const viewports = [];
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Overflow at ${width}px`,
    );
    viewports.push(width);
    const footer = await page.locator(".footer-meta").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        first = el.firstElementChild.getBoundingClientRect(),
        last = el.lastElementChild.getBoundingClientRect();
      return {
        left: Math.abs(first.left - r.left),
        right: Math.abs(last.right - r.right),
        width: r.width,
      };
    });
    assert.ok(
      footer.left < 2 && footer.right < 2,
      `Footer edge alignment at ${width}px`,
    );
    if (width === 390)
      await page.screenshot({
        path: "artifacts/home-mobile.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  assert.equal(
    await page
      .locator(".work-grid,.notes-list,#about,#contact,#attachments")
      .count(),
    0,
    "Homepage only contains curated navigation",
  );
  for (const viewport of [
    { width: 1920, height: 890 },
    { width: 1366, height: 600 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const copyBox = await page.locator(".hero-copy").boundingBox();
    const featuredBox = await page.locator(".featured-card").boundingBox();
    assert.ok(
      featuredBox.y >= copyBox.y + copyBox.height + 20,
      `Hero overlap at ${viewport.width}x${viewport.height}`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  await page.locator("[data-work-lab][data-engine]").waitFor();
  assert.equal(await page.locator(".work-card").count(),0,"Old portfolio fields start empty");
  assert.equal(await page.locator("[data-work-lab]").getAttribute("data-empty"),"true");
  assert.equal(await page.locator("[data-work-lab]").getAttribute("data-mode"),"browse");
  await page.goto(`${origin}/journal/`, { waitUntil: "networkidle" });
  await page.locator(".note-item summary").first().click();
  await settleCanvas();
  assert.equal(
    await page.locator(".note-item").first().getAttribute("open"),
    "",
  );
  await page.goto(`${origin}/about/`, { waitUntil: "networkidle" });
  await page.locator("[data-audio-toggle]").click();
  await settleCanvas();
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 0,
  );
  await page.locator("[data-audio-toggle]").click();
  await settleCanvas();
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await settleCanvas();
  await page.getByRole("dialog", { name: "EXPLORE THE SPACE" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "開啟選單", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  for (const [route, title] of [
    ["work", "作品"],
    ["journal", "筆記"],
    ["about", "關於"],
    ["resources", "資源"],
  ]) {
    await page.goto(`${origin}/${route}/`, { waitUntil: "networkidle" });
    assert.equal(await page.title(), `${title} — OutDesign`);
    assert.equal(await page.locator("h1").count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Overflow on ${route}`,
    );
    await page.setViewportSize({ width: 1440, height: 1080 });
  }
  await page.goto(origin, { waitUntil: "networkidle" });
  const publicAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    "artifacts/accessibility-public.json",
    JSON.stringify(publicAxe.violations, null, 2),
  );
  const severePublic = publicAxe.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact),
  );
  console.log(
    "Public experience verified: filters, dialogs, notes, audio, five viewport sizes, deferred editor.",
  );
  await page.getByRole("button", { name: "作者模式" }).click();
  await settleCanvas();
  await page.getByRole("heading", { name: "設定你的作者入口" }).waitFor();
  await page.screenshot({ path: "artifacts/author-login.png" });
  const password1 = crypto.randomUUID() + "-first",
    password2 = crypto.randomUUID() + "-second";
  await page.getByLabel("第一組密碼", { exact: true }).fill(password1);
  await page.getByLabel("第二組密碼", { exact: true }).fill(password2);
  await page.getByRole("button", { name: "設定並進入編輯" }).click();
  await settleCanvas();
  await page.locator(".editor-panel").waitFor();
  const { editorPerformance, severeEditor } = await studioRegression({
    page,
    api,
    settleCanvas,
    password1,
    password2,
  });
  await pageLoadingRegression({ browser, origin });
  await workLabRegression({ page, api, origin });
  await workLabTrackingRegression({ browser, origin });
  await workLabAuthorRegression({ page, api, password1, password2 });
  await siteThemeRegression({ page, origin });
  assert.deepEqual(errors, []);
  const results = {
    viewports,
    editorPerformance,
    publicAccessibility: severePublic.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    editorAccessibility: severeEditor.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    runtimeErrors: errors,
    verified: [
      "original text/card/logo editing, pointer movement, deletion/restore and undo",
      "PS-style layer tree, original section ordering, locks and resize handles",
      "left and right horizontal panel resizing and drawing tools",
      "per-page browser tab title persists through publication",
      "independent Scratch-style workspace, typed branches, variables and drag connections",
      "logic preview executes nested scripts and cleans up on close",
      "image import creates an editable layer and a script with public media after publishing",
      "named private assemblies, custom appearance, atomic duplicate/delete/undo",
      "99-node input performance and coalesced history",
      "isolated live code preview and invalid-input retention",
      "original five pages, mobile layout, audio/notes/filters/dialogs",
      "image/audio/attachment uploads, save, publish, history, wrong password and storage isolation",
    ],
  };
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  assert.deepEqual(severePublic, [], "Public accessibility");
  assert.deepEqual(severeEditor, [], "Editor accessibility");
} catch (e) {
  console.error(e);
  if (browser)
    for (const context of browser.contexts())
      for (const tab of context.pages()) {
        await tab
          .screenshot({ path: "artifacts/regression-failure.png" })
          .catch(() => {});
        console.error("Failure URL:", tab.url());
      }
  console.error(output.slice(-4000));
  process.exitCode = 1;
} finally {
  await browser?.close();
  child.kill();
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(resolve, 3000);
  });
  await api.close();
  const target = resolve(directory);
  assert.ok(
    target.startsWith(resolve(tmpdir()) + sep) &&
      basename(target).startsWith("outdesign-browser-"),
  );
  await rm(target, { recursive: true, force: true });
}
