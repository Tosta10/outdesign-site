import { chromium } from "@playwright/test";
import { dev } from "astro";
import { createServer } from "node:net";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from 'node:fs';
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { startLocalApi } from "../server/local-api.mjs";

// Independent disposable content and credentials; never uses the trial server.
const output = process.argv.find((arg, i) => i > 1 && !arg.startsWith("--")) || "artifacts/runtime-profile.json";
const software = process.argv.includes("--software");
const cpuRate = Math.max(1, Math.min(8, Number(process.argv.find(arg => arg.startsWith('--cpu='))?.split('=')[1]) || 1));
const cycles = Math.max(0, Math.min(20, Number(process.argv.find(arg => arg.startsWith('--cycles='))?.split('=')[1]) || 0));
const directory = await mkdtemp(join(tmpdir(), "outdesign-profile-"));
const probe = createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const api = await startLocalApi({ directory, port: 0, allowedOrigins: [origin] });
process.env.PUBLIC_API_URL = `${api.url}/api`;
process.env.BASE_PATH = "/";
process.env.SITE_URL = origin;
const server = await dev({ server: { host: "127.0.0.1", port }, cacheDir: join(directory, "astro"), vite: { cacheDir: join(directory, "vite") } });
let browser, profilingPage;
const results = { source: "Isolated local development build; laboratory diagnostics, not field INP or physical-device results", software, cpuRate, stages: [], lifecycle: [] };
try {
  browser = await chromium.launch({ headless: true, channel: process.platform === "win32" ? "msedge" : undefined,
    args: software ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  if (software) page.setDefaultTimeout(60000);
  profilingPage = page;
  await page.addInitScript(() => localStorage.setItem("outdesign.work-lab.preferences.v2", JSON.stringify({ motionPreset: "full", effects: { boot: false } })));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (cpuRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  const collect = async name => {
    if (process.argv.includes('--lifecycle-only')) return;
    const beforeMetrics = await cdp.send("Performance.getMetrics");
    const measurement = await page.evaluate(async () => {
      const scenes = () => {
        const docs = [document];
        document.querySelectorAll("iframe").forEach(frame => { try { if (frame.contentDocument) docs.push(frame.contentDocument); } catch {} });
        return docs.flatMap(doc => [...doc.querySelectorAll(".lab-stage")].map((el, index) => ({
          id: `${doc.defaultView?.frameElement?.title || "main"}:${el.closest("#public-site") ? "public" : "author"}:${index}`,
          frames: +el.dataset.frames || 0, delta: +el.dataset.frameDelta || 0, state: el.dataset.renderState, visible: el.dataset.visible,
          cells: el.dataset.renderedCells === undefined ? +el.dataset.arrayCells || 0 : +el.dataset.renderedCells,
          width: el.querySelector("canvas")?.width, height: el.querySelector("canvas")?.height,
        })));
      };
      const longTasks = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: "longtask" });
      const before = scenes(), started = performance.now();
      await new Promise(resolve => setTimeout(resolve, 2400));
      const seconds = (performance.now() - started) / 1000, after = scenes();
      observer.disconnect();
      return { seconds, longTasks, scenes: after.map(scene => ({ ...scene, fps: (scene.frames - (before.find(old => old.id === scene.id)?.frames || 0)) / seconds })) };
    });
    const afterMetrics = await cdp.send("Performance.getMetrics");
    const metric = (list, name) => list.metrics.find(metric => metric.name === name)?.value || 0;
    results.stages.push({ name, ...measurement, taskMs: (metric(afterMetrics, "TaskDuration") - metric(beforeMetrics, "TaskDuration")) * 1000,
      heapBytes: metric(afterMetrics, "JSHeapUsedSize"), domNodes: metric(afterMetrics, "Nodes") });
    console.log(name, JSON.stringify(results.stages.at(-1)));
  };
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.pageState === "ready");
  await collect("home-public-idle");
  const card = page.locator(".mission-card");
  const bounds = await card.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .85, bounds.y + bounds.height * .25);
  await page.waitForTimeout(400);
  results.homeTilt = await card.evaluate(el => ({ transform: getComputedStyle(el).transform, inline: el.style.transform, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches }));
  await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.pageState === 'ready');
  await page.waitForFunction(() => +document.querySelector(".lab-stage")?.dataset.frames >= 12);
  await collect("work-public-idle");
  await page.getByRole("button", { name: "作者模式", exact: true }).click();
  await page.getByLabel("第一組密碼", { exact: true }).waitFor();
  await collect("work-author-locked");
  await page.getByLabel("第一組密碼", { exact: true }).fill(crypto.randomUUID() + "-first");
  await page.getByLabel("第二組密碼", { exact: true }).fill(crypto.randomUUID() + "-second");
  await page.getByRole("button", { name: "設定並進入編輯", exact: true }).click();
  await page.locator('.editor-canvas .lab-stage[data-ready="true"]').waitFor();
  await page.waitForFunction(() => +document.querySelector('.editor-canvas .lab-stage')?.dataset.frames >= 8);
  await collect("work-author-layers");
  await page.getByRole("tab", { name: "代碼", exact: true }).click();
  await page.getByRole("button", { name: "展開工作區", exact: true }).click();
  await page.frameLocator('iframe[title="代碼即時預覽"]').locator('.lab-stage').waitFor();
  await collect("work-author-code-preview");
  await page.getByRole("button", { name: "關閉代碼工作區", exact: true }).click();
  await page.getByLabel("切換模式", { exact: true }).selectOption("blocks");
  await page.frameLocator('iframe[title="積木即時預覽"]').locator('.lab-stage[data-ready="true"]').waitFor();
  await page.waitForFunction(() => +document.querySelector('iframe[title="積木即時預覽"]')?.contentDocument?.querySelector('.lab-stage')?.dataset.frames >= 8);
  await collect("work-author-block-thumbnail");
  await page.getByRole("button", { name: /執行預覽/ }).click();
  await page.locator('.logic-live-preview .lab-stage[data-ready="true"]').waitFor();
  await page.waitForFunction(() => +document.querySelector('.logic-live-preview .lab-stage')?.dataset.frames >= 8);
  await collect("work-author-interactive-preview");
  for (let cycle = 0; cycle <= cycles && cycles > 0; cycle++) {
    await page.getByRole('button', { name: '關閉積木視窗', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.logic-live-preview'));
    await page.frameLocator('iframe[title="積木即時預覽"]').locator('.lab-stage[data-render-state="active"]').waitFor();
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = await cdp.send('Performance.getMetrics');
    const dom = await cdp.send('Memory.getDOMCounters');
    results.lifecycle.push({ cycle, heapBytes: metrics.metrics.find(metric => metric.name === 'JSHeapUsedSize')?.value, ...dom });
    if (cycle === cycles) break;
    await page.getByRole('button', { name: /執行預覽/ }).click();
    await page.locator('.logic-live-preview .lab-stage[data-ready="true"]').waitFor();
    await page.waitForFunction(() => document.querySelector('iframe[title="積木即時預覽"]')?.contentDocument?.querySelector('.lab-stage')?.dataset.renderState === 'paused');
  }
  if (process.argv.includes('--heap')) {
    const stream = createWriteStream(output + '.heapsnapshot');
    cdp.on('HeapProfiler.addHeapSnapshotChunk', ({chunk}) => stream.write(chunk));
    await cdp.send('HeapProfiler.takeHeapSnapshot');
    await new Promise(resolve => stream.end(resolve));
  }
} catch (error) {
  results.error = String(error.stack || error); process.exitCode = 1;
  try { results.failureState = await profilingPage?.evaluate(() => ({ pageState: document.body.dataset.pageState, fonts: document.fonts.status, loader: {...document.querySelector('[data-page-loader]')?.dataset}, stage: {...document.querySelector('.lab-stage')?.dataset} })); } catch {}
}
finally {
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(results, null, 2));
  await browser?.close(); await server.stop(); await api.close();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep) || !directory.includes("outdesign-profile-")) throw Error("Unsafe profile path");
  await rm(directory, { recursive: true, force: true });
}
