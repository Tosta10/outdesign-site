import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { startLocalApi } from "../server/local-api.mjs";

const directory = await mkdtemp(join(tmpdir(), "outdesign-section-reorder-"));
const probe = createServer();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const origin = `http://127.0.0.1:${port}`;
const api = await startLocalApi({ directory, port: 0, allowedOrigins: [origin] });
const password1 = crypto.randomUUID() + "-first", password2 = crypto.randomUUID() + "-second";
const request = async (path, method = "GET", body, token) => {
  const response = await fetch(api.url + "/api" + path, { method, headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(response.ok, true, `${method} ${path}: ${response.status}`);
  return response.json();
};
await request("/setup", "POST", { password1, password2 });
const { token } = await request("/login", "POST", { password1, password2 });
const astro = JSON.parse(await readFile("node_modules/astro/package.json", "utf8"));
const child = spawn(process.execPath, [join("node_modules/astro", astro.bin.astro), "dev", "--ignore-lock", "--host", "127.0.0.1", "--port", String(port)], { env: { ...process.env, PUBLIC_API_URL: api.url + "/api", SITE_URL: origin, BASE_PATH: "/", CONTENT_REQUIRED: "false" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "", browser;
child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; });
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.ok(ready, output.slice(-2000));
  browser = await chromium.launch({ headless: true, channel: process.platform === "win32" ? "msedge" : undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, reducedMotion: "reduce" });
  const errors = [], writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "PATCH" && request.url().endsWith("/draft")) writes.push(JSON.parse(request.postData()).content.layout?.sections); });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.keyboard.press("Alt+e");
  await page.getByLabel("第一組密碼", { exact: true }).fill(password1);
  await page.getByLabel("第二組密碼", { exact: true }).fill(password2);
  await page.getByRole("button", { name: "進入作者模式", exact: true }).click();
  await page.locator(".editor-panel").waitFor();
  const settled = () => page.waitForFunction(() => document.querySelector(".editor-shell")?.dataset.previewPending !== "true");
  await page.getByLabel("預覽頁面", { exact: true }).selectOption("about");
  await settled();
  const from = page.getByRole("button", { name: "選取圖層：聯絡區塊", exact: true }).locator("..");
  const to = page.getByRole("button", { name: "選取圖層：關於區塊", exact: true }).locator("..");
  // Keep both source and target visible: dragTo may otherwise start on a different
  // row after independently scrolling two distant targets in this scroll panel.
  await page.getByRole("button", { name: "收合圖層：關於區塊", exact: true }).click();
  const info = async () => ({
    from: await from.evaluate((element) => ({ draggable: element.draggable, text: element.textContent, bounds: element.getBoundingClientRect().toJSON() })),
    to: await to.evaluate((element) => ({ draggable: element.draggable, text: element.textContent, bounds: element.getBoundingClientRect().toJSON() })),
    sections: await page.locator(".editor-canvas [data-layout^='section:']").evaluateAll((elements) => elements.map((element) => ({ id: element.id, key: element.dataset.elementKey, parent: element.parentElement.closest("[data-element-key]")?.dataset.elementKey || null, y: element.getBoundingClientRect().y }))),
  });
  const before = await info();
  await page.evaluate(() => { window.__sectionDragEvents = []; for (const name of ["dragstart", "drop"]) document.addEventListener(name, (event) => { window.__sectionDragEvents.push({ name, text: event.target.closest(".ps-layer-row")?.textContent, y: event.clientY, types: [...event.dataTransfer.types], value: event.dataTransfer.getData("application/outdesign-layer") }); }, true); });
  await from.dragTo(to, { targetPosition: { x: 80, y: 2 } });
  await settled();
  const save = page.getByRole("button", { name: "儲存", exact: true });
  if (await save.isEnabled()) await save.click();
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  const after = await info();
  const stored = await request("/draft", "GET", undefined, token);
  const result = { before, after, writes, storedSections: stored.content.layout?.sections, dragEvents: await page.evaluate(() => window.__sectionDragEvents), errors };
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/author-section-reorder-results.json", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "artifacts/author-section-reorder.png" });
  console.log(JSON.stringify(result, null, 2));
  assert.ok(after.sections.find((item) => item.id === "contact").y < after.sections.find((item) => item.id === "about").y, "section drag reorders actual canvas");
  assert.ok(stored.content.layout.sections.indexOf("contact") < stored.content.layout.sections.indexOf("about"), "section order persists to the isolated draft");
  assert.deepEqual(errors, []);
} catch (error) {
  console.error(error, output.slice(-1500)); process.exitCode = 1;
} finally {
  await browser?.close(); child.kill();
  await new Promise((done) => { if (child.exitCode !== null) return done(); child.once("exit", done); setTimeout(done, 3000); });
  await api.close();
  const target = resolve(directory);
  assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith("outdesign-section-reorder-"));
  await rm(target, { recursive: true, force: true });
}
