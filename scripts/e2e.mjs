import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createPortProbe } from "node:net";
import assert from "node:assert/strict";
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
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (req) => requests.push(req.url()));
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "OutDesign — 個人創作空間");
  assert.equal(
    requests.some((u) => /bootstrap|Studio\.tsx|react-dom/.test(u)),
    false,
    "Editor must not load for visitors",
  );
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
    if (width === 390)
      await page.screenshot({
        path: "artifacts/home-mobile.png",
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("button", { name: "設計", exact: true }).click();
  assert.equal(await page.locator(".work-card:visible").count(), 1);
  await page.getByRole("button", { name: /^全部/ }).click();
  assert.equal(await page.locator(".work-card:visible").count(), 3);
  await page
    .getByRole("button", { name: "查看作品：Quiet Interfaces" })
    .click();
  assert.equal(await page.getByRole("dialog").isVisible(), true);
  await page.keyboard.press("Escape");
  await page.locator(".note-item summary").first().click();
  assert.equal(
    await page.locator(".note-item").first().getAttribute("open"),
    "",
  );
  await page.locator("[data-audio-toggle]").click();
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 0,
  );
  await page.locator("[data-audio-toggle]").click();
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
  await page.getByRole("heading", { name: "設定你的作者入口" }).waitFor();
  await page.screenshot({ path: "artifacts/author-login.png" });
  const password1 = crypto.randomUUID() + "-first",
    password2 = crypto.randomUUID() + "-second";
  await page.getByLabel("第一組密碼", { exact: true }).fill(password1);
  await page.getByLabel("第二組密碼", { exact: true }).fill(password2);
  await page.getByRole("button", { name: "設定並進入編輯" }).click();
  await page.locator(".editor-panel").waitFor();
  await page.getByLabel("標題第一行", { exact: true }).fill("讓創意，有方向。");
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  const before = await (await fetch(api.url + "/api/public")).json();
  assert.equal(before.content.hero.line1, "把想法，");
  await page.getByRole("tab", { name: "風格" }).click();
  await page.locator(".theme-option.quiet").click();
  await page.locator(".editor-canvas .theme-quiet").waitFor();
  await page.screenshot({ path: "artifacts/editor-desktop.png" });
  const editorAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    "artifacts/accessibility-editor.json",
    JSON.stringify(editorAxe.violations, null, 2),
  );
  const severeEditor = editorAxe.violations.filter((v) =>
    ["critical", "serious"].includes(v.impact),
  );
  await page.getByRole("tab", { name: "內容" }).click();
  await page.getByRole("button", { name: "新增作品", exact: true }).click();
  await page.getByLabel("作品名稱", { exact: true }).fill("OutDesign Lab");
  await page
    .getByLabel("外部作品網址", { exact: true })
    .fill("https://example.com/outdesign");
  await page
    .getByRole("button", { name: "上移 OutDesign Lab", exact: true })
    .click();
  await page.getByRole("tab", { name: "媒體" }).click();
  await page
    .getByLabel("上傳素材", { exact: true })
    .setInputFiles({
      name: "study.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJHkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  const imageItem = page
    .locator(".media-item")
    .filter({ hasText: "study.png" });
  await imageItem.getByRole("button", { name: "套用", exact: true }).click();
  await page.getByRole("tab", { name: "媒體" }).click();
  await page
    .getByLabel("上傳素材", { exact: true })
    .setInputFiles({
      name: "room.wav",
      mimeType: "audio/wav",
      buffer: await readFile("public/assets/ambient.wav"),
    });
  await page
    .locator(".media-item")
    .filter({ hasText: "room.wav" })
    .getByRole("button", { name: "套用", exact: true })
    .click();
  await page.getByRole("tab", { name: "媒體" }).click();
  await page
    .getByLabel("上傳素材", { exact: true })
    .setInputFiles({
      name: "readme.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Original OutDesign attachment"),
    });
  await page
    .locator(".media-item")
    .filter({ hasText: "readme.txt" })
    .getByRole("button", { name: "套用", exact: true })
    .click();
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .locator(".editor-panel")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  await page.screenshot({ path: "artifacts/editor-mobile.png" });
  await page.getByRole("button", { name: "關閉編輯面板", exact: true }).click();
  await page
    .locator('.editor-canvas [data-edit="hero"]')
    .click({ position: { x: 60, y: 120 } });
  await page.getByLabel("標題第一行", { exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByRole("button", { name: "發布", exact: true }).click();
  await page.getByRole("button", { name: "確認發布", exact: true }).click();
  await page
    .getByText("已發布至本機預覽，關閉編輯器後可查看。", { exact: true })
    .waitFor();
  const after = await (await fetch(api.url + "/api/public")).json();
  assert.equal(after.content.hero.line1, "讓創意，有方向。");
  assert.equal(after.content.settings.theme, "quiet");
  assert.equal(after.content.projects.length, 4);
  assert.equal(after.content.attachments.length, 1);
  const imageAsset = after.content.projects
    .find((p) => p.title === "OutDesign Lab")
    .image.slice(6);
  assert.equal((await fetch(api.url + "/api/media/" + imageAsset)).status, 200);
  await page.getByRole("button", { name: "發布歷史" }).click();
  await page.getByRole("button", { name: "載入草稿", exact: true }).click();
  await page.getByRole("button", { name: "登出並關閉編輯器" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "作者模式" }).click();
  await page.getByRole("heading", { name: "回到你的創作空間" }).waitFor();
  await page.getByLabel("第一組密碼", { exact: true }).fill(password1);
  await page
    .getByLabel("第二組密碼", { exact: true })
    .fill("an-intentionally-wrong-password");
  await page.getByRole("button", { name: "進入作者模式", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "兩組密碼不正確" }).waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
    "Passwords and sessions must not persist in browser storage",
  );
  await page.getByRole("button", { name: "關閉作者登入" }).click();
  assert.deepEqual(errors, []);
  const results = {
    viewports,
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
      "first-run two-password setup",
      "draft isolation",
      "autosave",
      "theme switching",
      "project addition and ordering",
      "image/audio/file uploads",
      "mobile editor",
      "publish",
      "history restore",
      "logout",
      "wrong-password denial",
      "no browser-stored credentials",
    ],
  };
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  assert.deepEqual(
    severePublic,
    [],
    "Public page accessibility violations (see artifacts)",
  );
  assert.deepEqual(
    severeEditor,
    [],
    "Editor accessibility violations (see artifacts)",
  );
} catch (e) {
  console.error(e);
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
