import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer as createPortProbe } from "node:net";
import assert from "node:assert/strict";
import { createCanvasNode } from "../src/lib/workspace.ts";
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
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE|shader|WebGLProgram/i.test(message.text())
    )
      errors.push(message.text());
  });
  page.on("request", (req) => requests.push(req.url()));
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "OutDesign — 個人創作空間");
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
  await page.getByRole("button", { name: "設計", exact: true }).click();
  await settleCanvas();
  assert.equal(await page.locator(".work-card:visible").count(), 1);
  await page.getByRole("button", { name: /^全部/ }).click();
  await settleCanvas();
  assert.equal(await page.locator(".work-card:visible").count(), 3);
  await page
    .getByRole("button", { name: "查看作品：Quiet Interfaces" })
    .click();
  await settleCanvas();
  assert.equal(await page.getByRole("dialog").isVisible(), true);
  await page.keyboard.press("Escape");
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
  // Direct selection resolves nested hero cards rather than the whole hero.
  await page.locator(".editor-canvas .mission-card h2").click();
  await settleCanvas();
  await page.getByLabel("關於我的標題", { exact: true }).waitFor();
  await page.locator(".editor-canvas .mission-card h2").hover();
  assert.equal(
    await page
      .locator(".editor-canvas .mission-card")
      .evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(38, 132, 255)",
  );
  await page.locator(".editor-canvas .featured-card h2").hover();
  assert.equal(
    await page
      .locator(".editor-canvas .featured-card")
      .evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(77, 163, 255)",
  );
  const nestedCopy = page.locator(
    '.editor-canvas [data-edit="copy:featured.meta"]',
  );
  await nestedCopy.hover();
  assert.equal(
    await nestedCopy.evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(77, 163, 255)",
  );
  assert.notEqual(
    await page
      .locator(".editor-canvas .featured-card")
      .evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(77, 163, 255)",
  );
  await page.screenshot({ path: "artifacts/editor-hover-target.png" });
  await page.locator(".editor-canvas .featured-card h2").click();
  await settleCanvas();
  await page.getByLabel("作品名稱", { exact: true }).waitFor();
  await page.locator(".editor-canvas .wordmark").click();
  await settleCanvas();
  await page.getByLabel("品牌圖標", { exact: true }).waitFor();
  await page.getByRole("button", { name: "積木模式", exact: true }).click();
  await settleCanvas();
  await page
    .getByRole("button", { name: "插入積木：內容面板", exact: true })
    .click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 3);
  await page.getByText("顏色、邊框與效果", { exact: true }).click();
  await page.getByLabel("面板邊框色", { exact: true }).fill("#4455aa");
  await page.getByLabel("面板邊框粗細", { exact: true }).fill("2");
  await page.getByLabel("面板陰影", { exact: true }).selectOption("soft");
  await page.getByLabel("面板懸停效果", { exact: true }).selectOption("glow");
  await settleCanvas();
  assert.equal(
    await page
      .locator(".editor-canvas .node-frame")
      .evaluate((el) => el.style.borderWidth),
    "2px",
  );
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".editor-canvas .node-frame").hover();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector(".editor-canvas .node-frame"))
        .filter === "brightness(1.12)",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".editor-canvas .node-frame")
      .evaluate((el) => getComputedStyle(el).filter),
    "none",
  );
  await page.getByRole("button", { name: "繼續編輯", exact: true }).click();
  await page.locator(".assembly-panel summary").click();
  await page.getByLabel("組裝名稱", { exact: true }).fill("我的資訊模組");
  await page.getByRole("button", { name: "儲存為組裝", exact: true }).click();
  await settleCanvas();
  await page
    .getByRole("button", { name: "插入組裝：我的資訊模組", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "刪除面板：內容面板", exact: true })
    .click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 0);
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 3);
  await page
    .getByRole("button", { name: "插入組裝：我的資訊模組", exact: true })
    .click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 6);
  await page.locator(".assembly-panel summary").click();
  await page
    .getByLabel("套用組裝", { exact: true })
    .selectOption({ label: "我的資訊模組 · 3 積木" });
  await settleCanvas();
  await page.screenshot({ path: "artifacts/blueprint-blocks.png" });
  // Replacement, insertion and saving remain atomic; field typing may coalesce.
  for(const expected of [6,3,3]) {
    await page.getByRole("button",{name:"復原上一步",exact:true}).click();
    await settleCanvas();
    assert.equal(await page.locator(".editor-canvas .canvas-node").count(),expected);
  }
  assert.equal(await page.getByRole("button",{name:"插入組裝：我的資訊模組",exact:true}).count(),0);
  for(let i=0;i<8 && await page.locator(".editor-canvas .canvas-node").count();i++) {
    await page.getByRole("button",{name:"復原上一步",exact:true}).click();await settleCanvas();
  }
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(),0);
  await page.getByRole("button", { name: "圖層", exact: true }).click();
  await settleCanvas();
  await page.locator(".editor-canvas .hero-copy h1").click();
  await settleCanvas();
  await page.getByLabel("標題第一行", { exact: true }).fill("讓創意，有方向。");
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  const before = await (await fetch(api.url + "/api/public")).json();
  assert.equal(before.content.hero.line1, "把想法，");
  await page.getByRole("tab", { name: "風格" }).click();
  await settleCanvas();
  assert.equal(await page.locator(".theme-option").count(), 0);
  await page.getByLabel("強調色", { exact: true }).fill("#a7c8ae");
  await settleCanvas();
  async function applyScopedCode(mutate) {
    await page.getByRole("button", { name: /^此面板的程式碼/ }).click();
    await settleCanvas();
    const editor = page.getByLabel("面板程式碼", { exact: true });
    const value = JSON.parse(await editor.inputValue());
    mutate(value);
    await editor.fill(JSON.stringify(value, null, 2));
    await page
      .getByRole("button", { name: "套用面板代碼", exact: true })
      .click();
    await settleCanvas();
    await page.getByText("已驗證並套用，可復原。", { exact: true }).waitFor();
    return value;
  }
  await applyScopedCode((value) => {
    assert.equal(value.theme, "prism");
    value.design.accent = "#a7c8af";
  });
  assert.equal(
    await page
      .locator(".editor-canvas .site")
      .evaluate((el) => el.style.getPropertyValue("--color-accent")),
    "#a7c8af",
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();

  await page.getByLabel("預覽頁面", { exact: true }).selectOption("about");
  await settleCanvas();
  await page
    .getByRole("button", { name: "拖曳排序：關於", exact: true })
    .press("ArrowDown");
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  assert.equal(
    (await fetch(api.url + "/api/draft")).status,
    401,
    "Draft remains private",
  );
  assert.equal(
    await page
      .locator(".editor-canvas .page-content>section")
      .first()
      .getAttribute("id"),
    "contact",
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  assert.equal(
    await page
      .locator(".editor-canvas .page-content>section")
      .first()
      .getAttribute("id"),
    "about",
  );
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
  await page.getByRole("tab", { name: "互動" }).click();
  await settleCanvas();
  await page.getByLabel("卡片互動", { exact: true }).selectOption("lift");
  await settleCanvas();
  await page.getByLabel("頁面切換", { exact: true }).selectOption("slide");
  await settleCanvas();
  await page.getByRole("button", { name: "自定義：檢視屬性與實作" }).click();
  await settleCanvas();
  assert.ok(
    (await page.locator(".source-preview").nth(1).textContent()).includes(
      "requestAnimationFrame",
    ),
  );
  await applyScopedCode((value) => {
    value.press = false;
  });
  assert.equal(
    await page.getByLabel("按壓回饋", { exact: true }).isChecked(),
    false,
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  await page.getByRole("tab", { name: "代碼", exact: true }).click();
  await settleCanvas();
  const code = page.getByLabel("網站程式碼", { exact: true });
  const baseline = await code.inputValue();
  // Stress the immutable history and deferred canvas with 99 composed nodes.
  const stress = JSON.parse(baseline);
  stress.workspace = { nodes: [] };
  for (let i = 0; i < 33; i++) {
    const frame = createCanvasNode("about", "frame");
    const title = createCanvasNode("about", "text", frame.id);
    title.body = `效能測試積木 ${i + 1}`;
    const body = createCanvasNode("about", "text", frame.id);
    body.body = "用於量測輸入與畫布更新的測試內容。";
    stress.workspace.nodes.push(frame, title, body);
  }
  await code.fill(JSON.stringify(stress));
  await page.getByRole("button", { name: "驗證並套用", exact: true }).click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 99);
  await page.getByRole("tab", { name: "內容", exact: true }).click();
  await settleCanvas();
  await page.evaluate(() => {
    window.__editorBench = { samples: [], longTasks: [] };
    window.__editorInput = () => {
      const start = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          window.__editorBench.samples.push(performance.now() - start),
        ),
      );
    };
    document
      .querySelector(".editor-panel")
      .addEventListener("input", window.__editorInput);
    window.__editorObserver = new PerformanceObserver((list) =>
      window.__editorBench.longTasks.push(
        ...list.getEntries().map((entry) => entry.duration),
      ),
    );
    window.__editorObserver.observe({ type: "longtask" });
  });
  await page
    .getByLabel("自我介紹", { exact: true })
    .pressSequentially("保持輸入流暢，讓畫布即時回應。".repeat(8), {
      delay: 5,
    });
  await settleCanvas();
  await page.waitForTimeout(80);
  const editorPerformance = await page.evaluate(() => {
    document
      .querySelector(".editor-panel")
      .removeEventListener("input", window.__editorInput);
    window.__editorObserver.disconnect();
    const values = window.__editorBench.samples.sort((a, b) => a - b);
    const p = (q) =>
      Math.round(values[Math.max(0, Math.ceil(values.length * q) - 1)] * 10) /
      10;
    return {
      source:
        "Local automated Edge; 99 nodes; input event to two animation frames; not field INP",
      samples: values.length,
      medianMs: p(0.5),
      p95Ms: p(0.95),
      maxMs: p(1),
      longTasksOver50ms: window.__editorBench.longTasks.length,
      maxLongTaskMs: Math.round(Math.max(0, ...window.__editorBench.longTasks)),
    };
  });
  await writeFile(
    "artifacts/editor-performance.json",
    JSON.stringify(editorPerformance, null, 2),
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .canvas-node").count(),
    0,
    "Grouped typing and whole composition undo independently",
  );
  await page.getByRole("tab", { name: "代碼", exact: true }).click();
  await settleCanvas();

  await page.getByRole("button", { name: "展開工作區", exact: true }).click();
  await settleCanvas();
  const frame = page.frameLocator('iframe[title="代碼即時預覽"]');
  const previewCandidate = JSON.parse(baseline);
  previewCandidate.about.title = "即時預覽尚未套用";
  await code.fill(JSON.stringify(previewCandidate));
  await frame
    .locator("#about h2")
    .filter({ hasText: "即時預覽尚未套用" })
    .waitFor();
  assert.notEqual(
    await page.locator(".editor-canvas #about h2").textContent(),
    "即時預覽尚未套用",
  );
  await code.fill("{invalid");
  await page.getByText("保留上次有效畫面", { exact: true }).waitFor();
  assert.equal(
    await frame
      .locator("#about h2")
      .filter({ hasText: "即時預覽尚未套用" })
      .count(),
    1,
  );
  await page.screenshot({ path: "artifacts/code-live-preview.png" });
  await code.fill(baseline);
  await page
    .getByRole("button", { name: "關閉代碼工作區", exact: true })
    .click();
  await settleCanvas();
  await code.fill('{"bad":true}');
  await page.getByRole("button", { name: "驗證並套用", exact: true }).click();
  await settleCanvas();
  assert.equal(await code.inputValue(), '{"bad":true}');
  assert.ok(
    (await page.locator(".code-message").textContent()).includes(
      "schemaVersion",
    ),
  );
  const bulk = JSON.parse(baseline);
  bulk.about.title = "測試批次編輯";
  await code.fill(JSON.stringify(bulk, null, 2));
  await page.getByRole("button", { name: "驗證並套用", exact: true }).click();
  await settleCanvas();
  await page
    .getByText("已套用至草稿並預覽。可用頂部復原；發布後才對訪客生效。", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator(".editor-canvas #about h2").textContent(),
    "測試批次編輯",
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  assert.notEqual(
    await page.locator(".editor-canvas #about h2").textContent(),
    "測試批次編輯",
  );
  await page.getByRole("button", { name: "載入目前草稿", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("編輯檔案", { exact: true }).selectOption("css");
  await settleCanvas();
  await code.fill((await code.inputValue()).replace("1280px", "1200px"));
  await page.getByRole("button", { name: "驗證並套用", exact: true }).click();
  await settleCanvas();
  assert.equal(
    await page
      .locator(".editor-canvas .site")
      .evaluate((el) => el.style.getPropertyValue("--page-width")),
    "1200px",
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  await page.getByRole("tab", { name: "內容" }).click();
  await settleCanvas();
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("work");
  await settleCanvas();
  assert.equal(await page.getByText("編輯區塊", { exact: true }).count(), 0);
  await applyScopedCode((value) => {
    assert.ok(Array.isArray(value.projects));
  });
  assert.equal(
    await page.getByLabel("作品名稱", { exact: true }).inputValue(),
    "Quiet Interfaces",
  );
  await page.locator(".editor-canvas .work-image-button").first().click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .detail-dialog[open]").count(),
    0,
  );
  await page
    .locator(".editor-canvas .work-image-button")
    .first()
    .press("Enter");
  assert.equal(
    await page.locator(".editor-canvas .detail-dialog[open]").count(),
    0,
  );
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await settleCanvas();
  await page.locator(".editor-canvas .work-image-button").first().click();
  await settleCanvas();
  await page.locator(".editor-canvas .detail-dialog[open]").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "繼續編輯", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("journal");
  await settleCanvas();
  await page.locator(".editor-canvas .note-item summary").first().click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .note-item[open]").count(),
    0,
  );
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("about");
  await settleCanvas();
  await page.locator(".editor-canvas [data-audio-toggle]").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas audio").evaluate((el) => el.paused),
    true,
  );
  await page.locator(".editor-canvas [data-audio-toggle]").press("Space");
  assert.equal(
    await page.locator(".editor-canvas audio").evaluate((el) => el.paused),
    true,
  );
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("home");
  await settleCanvas();
  await page.locator(".editor-canvas [data-menu-toggle]").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .nav-drawer[open]").count(),
    0,
  );
  await page.locator(".editor-canvas .featured-card").click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .page-home").count(), 1);
  await page.getByRole("tab", { name: "佈局", exact: true }).click();
  await settleCanvas();
  await page.getByRole("button", { name: "新增面板", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("圖層名稱", { exact: true }).fill("自由面板");
  await page.getByLabel("排版模式", { exact: true }).selectOption("free");
  await settleCanvas();
  await page.getByText("加入子積木", { exact: true }).click();
  await settleCanvas();
  await page.getByRole("button", { name: "新增文字", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("圖層名稱", { exact: true }).fill("文字 A");
  await page.getByLabel("圖層文字", { exact: true }).fill("自由排版內容");
  const freeMove = page.getByRole("button", {
    name: "移動圖層：文字 A",
    exact: true,
  });
  await freeMove.scrollIntoViewIfNeeded();
  const beforeX = Number(
    await page.getByLabel("X 位置 %", { exact: true }).inputValue(),
  );
  const moveBox = await freeMove.boundingBox();
  await page.mouse.move(moveBox.x + 20, moveBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(moveBox.x + 68, moveBox.y + 40, { steps: 8 });
  await page.mouse.up();
  assert.ok(
    Number(await page.getByLabel("X 位置 %", { exact: true }).inputValue()) >
      beforeX,
  );
  const widthBefore = Number(
    await page.getByLabel("寬度 px", { exact: true }).inputValue(),
  );
  await page
    .getByRole("button", { name: "調整尺寸：文字 A", exact: true })
    .scrollIntoViewIfNeeded();
  const resizeBox = await page
    .getByRole("button", { name: "調整尺寸：文字 A", exact: true })
    .boundingBox();
  await page.mouse.move(resizeBox.x + 6, resizeBox.y + 6);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 46, resizeBox.y + 30, { steps: 8 });
  await page.mouse.up();
  assert.ok(
    Number(await page.getByLabel("寬度 px", { exact: true }).inputValue()) >
      widthBefore,
  );
  await page.getByRole("button", { name: "復原上一步", exact: true }).click();
  await settleCanvas();
  assert.equal(
    Number(await page.getByLabel("寬度 px", { exact: true }).inputValue()),
    widthBefore,
  );
  await page.getByLabel("鎖定圖層", { exact: true }).check();
  await settleCanvas();
  assert.equal(await freeMove.count(), 0);
  await page.getByLabel("鎖定圖層", { exact: true }).uncheck();
  await settleCanvas();
  await page.getByLabel("隱藏圖層", { exact: true }).check();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .node-text:visible").count(),
    0,
  );
  await page.getByLabel("隱藏圖層", { exact: true }).uncheck();
  await settleCanvas();
  await page
    .getByRole("button", { name: "選取圖層：自由面板", exact: true })
    .click();
  await settleCanvas();
  await page.getByRole("button", { name: "複製圖層", exact: true }).click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 4);
  await page
    .getByRole("button", { name: "刪除此面板（可復原）", exact: true })
    .click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 2);
  await page
    .getByRole("button", { name: "選取圖層：自由面板", exact: true })
    .click();
  await settleCanvas();
  await page.getByLabel("排版模式", { exact: true }).selectOption("grid");
  await settleCanvas();
  assert.equal(
    await page
      .locator(".editor-canvas .node-frame")
      .evaluate((el) => getComputedStyle(el).display),
    "grid",
  );
  await page.getByLabel("排版模式", { exact: true }).selectOption("free");
  await settleCanvas();
  await page.getByRole("button", { name: /^此面板的程式碼/ }).click();
  await settleCanvas();
  const scopedEditor = page.getByLabel("面板程式碼", { exact: true });
  const workspaceCode = JSON.parse(await scopedEditor.inputValue());
  workspaceCode.nodes[0].gap = 40;
  await scopedEditor.fill(JSON.stringify(workspaceCode, null, 2));
  await page.getByRole("button", { name: "套用面板代碼", exact: true }).click();
  await settleCanvas();
  assert.equal(
    await page.getByLabel("圖層間距", { exact: true }).inputValue(),
    "40",
  );
  await page.getByLabel("畫布裝置", { exact: true }).selectOption("390");
  await settleCanvas();
  await page.getByLabel("畫布縮放", { exact: true }).selectOption("0.75");
  await settleCanvas();
  assert.equal(
    await page
      .locator(".editor-canvas .node-free")
      .evaluate((el) => getComputedStyle(el).position),
    "relative",
  );
  await page.screenshot({ path: "artifacts/workspace-mobile-frame.png" });
  await page.getByLabel("畫布裝置", { exact: true }).selectOption("auto");
  await settleCanvas();
  await page.getByLabel("畫布縮放", { exact: true }).selectOption("1");
  await settleCanvas();
  await page.screenshot({ path: "artifacts/workspace-free-layout.png" });
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("work");
  await settleCanvas();
  console.log(
    "Workspace verified: edit isolation, preview, auto selection, nested frames, free drag/resize, locks, scoped code and device layout.",
  );
  await page.getByRole("button", { name: "新增作品", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("作品名稱", { exact: true }).fill("OutDesign Lab");
  await page
    .getByLabel("外部作品網址", { exact: true })
    .fill("https://example.com/outdesign");
  await page
    .getByRole("button", { name: "上移 OutDesign Lab", exact: true })
    .click();
  await settleCanvas();
  const dragged = page.getByRole("button", {
    name: "拖曳排序：OutDesign Lab",
    exact: true,
  });
  const drop = page.locator(".editor-canvas [data-category]").first();
  await dragged.scrollIntoViewIfNeeded();
  const dragBox = await dragged.boundingBox(),
    dropBox = await drop.boundingBox();
  assert.ok(dragBox && dropBox);
  await page.mouse.move(
    dragBox.x + dragBox.width / 2,
    dragBox.y + dragBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(240);
  await page.mouse.move(
    dropBox.x + dropBox.width / 2,
    dropBox.y + dropBox.height / 2,
    { steps: 8 },
  );
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      document.querySelector(".editor-canvas .work-card h3")?.textContent ===
      "OutDesign Lab",
  );
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("journal");
  await settleCanvas();
  await page.locator(".editor-canvas .page-journal").waitFor();
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("home");
  await settleCanvas();
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("work");
  await settleCanvas();
  await page.getByRole("tab", { name: "媒體" }).click();
  await settleCanvas();
  await page.getByLabel("上傳素材", { exact: true }).setInputFiles({
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
  await settleCanvas();
  await page.getByRole("tab", { name: "媒體" }).click();
  await settleCanvas();
  await page.getByLabel("上傳素材", { exact: true }).setInputFiles({
    name: "room.wav",
    mimeType: "audio/wav",
    buffer: await readFile("public/assets/ambient.wav"),
  });
  await page
    .locator(".media-item")
    .filter({ hasText: "room.wav" })
    .getByRole("button", { name: "套用", exact: true })
    .click();
  await settleCanvas();
  await page.getByRole("tab", { name: "媒體" }).click();
  await settleCanvas();
  await page.getByLabel("上傳素材", { exact: true }).setInputFiles({
    name: "readme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Original OutDesign attachment"),
  });
  await page
    .locator(".media-item")
    .filter({ hasText: "readme.txt" })
    .getByRole("button", { name: "套用", exact: true })
    .click();
  await settleCanvas();
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "媒體", exact: true }).click();
  await settleCanvas();
  await applyScopedCode((value) => {
    assert.ok(Array.isArray(value.projectImages));
    assert.ok(Array.isArray(value.canvasImages));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page
      .locator(".editor-panel")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
    false,
  );
  await page.screenshot({ path: "artifacts/editor-mobile.png" });
  await page.getByRole("button", { name: "關閉編輯面板", exact: true }).click();
  await settleCanvas();
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("home");
  await settleCanvas();
  await page
    .locator('.editor-canvas [data-edit="hero"]')
    .click({ position: { x: 60, y: 120 } });
  await settleCanvas();
  await page.getByLabel("標題第一行", { exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("about");
  await settleCanvas();
  await page
    .getByRole("button", { name: "拖曳排序：關於", exact: true })
    .press("ArrowDown");
  await page.getByRole("button", { name: "發布", exact: true }).click();
  await settleCanvas();
  await page.getByRole("button", { name: "確認發布", exact: true }).click();
  await settleCanvas();
  await page
    .getByText("已發布至本機預覽，關閉編輯器後可查看。", { exact: true })
    .waitFor();
  const after = await (await fetch(api.url + "/api/public")).json();
  assert.equal(after.content.hero.line1, "讓創意，有方向。");
  assert.equal(after.content.settings.theme, "prism");
  assert.equal(after.content.projects.length, 4);
  assert.equal(after.content.interactions.card, "lift");
  assert.equal(after.content.interactions.transition, "slide");
  assert.equal(after.content.attachments.length, 1);
  assert.equal(after.content.workspace.nodes.length, 2);
  assert.equal(after.content.workspace.nodes[0].gap, 40);
  assert.equal(
    after.content.layout.sections.filter((key) =>
      ["about", "contact"].includes(key),
    )[0],
    "contact",
    "Canvas order persists through publication",
  );
  const imageAsset = after.content.projects
    .find((p) => p.title === "OutDesign Lab")
    .image.slice(6);
  assert.equal((await fetch(api.url + "/api/media/" + imageAsset)).status, 200);
  await page.getByRole("button", { name: "發布歷史" }).click();
  await settleCanvas();
  await page.getByRole("button", { name: "載入草稿", exact: true }).click();
  await settleCanvas();
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  // Publishing locally reloads the public page after the asynchronous logout.
  // Wait for that navigation before interacting with the next login dialog.
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "登出並關閉編輯器" }).click(),
  ]);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "作者模式" }).click();
  await settleCanvas();
  await page.getByRole("heading", { name: "回到你的創作空間" }).waitFor();
  await page.getByLabel("第一組密碼", { exact: true }).fill(password1);
  await page
    .getByLabel("第二組密碼", { exact: true })
    .fill("an-intentionally-wrong-password");
  await page.getByRole("button", { name: "進入作者模式", exact: true }).click();
  await settleCanvas();
  await page.getByRole("alert").filter({ hasText: "兩組密碼不正確" }).waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
    "Passwords and sessions must not persist in browser storage",
  );
  await page.getByRole("button", { name: "關閉作者登入" }).click();
  await settleCanvas();
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
      "99-node input responsiveness and grouped undo",
      "original homepage panels preserved; no WebGL",
      "direct card, text and brand selection",
      "blueprint assembly save/reuse/replacement, direct deletion and atomic undo",
      "isolated live code preview before apply and invalid-input retention",
      "first-run two-password setup",
      "draft isolation",
      "autosave",
      "palette and typed appearance customization",
      "project addition and ordering",
      "image/audio/file uploads",
      "mobile editor",
      "publish",
      "history restore",
      "five static pages with separated content and accessible navigation",
      "original hero cards stay separated on wide/short screens",
      "canvas keyboard section reordering and undo",
      "long-press pointer project reordering",
      "editor page switching and automatic page properties",
      "visitor interactions blocked while editing and restored in preview",
      "nested frames, free drag/resize, grid layout, lock/hide, duplicate and delete",
      "scoped panel code and responsive device canvas",
      "pointer tilt settling and reduced-motion fallback",
      "interaction configuration and source inspection",
      "invalid JSON rejection, bulk edit, typed CSS preview and undo",
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
