import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function workLabTrackingRegression({ browser, origin }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("outdesign.work-lab.preferences.v2", JSON.stringify({ motionPreset: "full", effects: { boot: false, idleWave: false } })));
  await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  const stage = page.locator(".lab-stage");
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.ready === "true");
  await stage.focus();
  const buildsBefore = Number(await stage.getAttribute("data-model-builds"));
  const held = [];
  // Actual repeated keydown messages keep the key held throughout the run.
  for (let n = 0; n < 100; n++) {
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(25);
    held.push(await stage.evaluate(el => ({ error: +el.dataset.trackingError, dt: +el.dataset.frameDelta, position: el.dataset.arrayPosition })));
  }
  await page.keyboard.up("ArrowDown");
  assert.ok(Number(await stage.getAttribute("data-movement-pulses")) > 15, "Repeated movement produces waves before selection standby completes");
  assert.ok(Math.max(...held.slice(4).map(n => n.error)) < 1.25, "Held navigation responds within one adjacent cell instead of accumulating spring lag");
  await page.waitForFunction(() => +document.querySelector(".lab-stage").dataset.trackingError < .015);
  const bounds = await stage.boundingBox();
  await page.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height * .45);
  await page.mouse.down();
  const dragged = [];
  for (let n = 0; n < 150; n++) {
    await page.mouse.move(bounds.x + bounds.width * (.35 + .18 * Math.sin(n / 12)), bounds.y + bounds.height * (.45 + .18 * Math.cos(n / 15)));
    await page.waitForTimeout(5);
    dragged.push(await stage.evaluate(el => ({ error: +el.dataset.trackingError, dt: +el.dataset.frameDelta, frames: +el.dataset.frames })));
  }
  await page.mouse.up();
  assert.ok(Math.max(...dragged.map(n => n.error)) < .01, "High-rate pointer updates directly own the camera's projected track");
  const dt = dragged.map(n => n.dt).sort((a, b) => a - b);
  assert.ok(dt[Math.floor(dt.length / 2)] > .009, "Repeated input must not reset the renderer clock between frames");
  assert.ok(dragged.at(-1).frames > dragged[0].frames + 15, "Rendering continues while the pointer remains held");
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.selectionPhase === "waiting");
  assert.equal(await stage.getAttribute("data-selection-material"), "archive");
  await page.mouse.move(bounds.x + bounds.width * .35, bounds.y + bounds.height * .45);
  await page.mouse.down();
  await page.waitForTimeout(650);
  assert.equal(await stage.getAttribute("data-selection-phase"), "tracking", "Holding input cancels the pending selection standby");
  assert.equal(await stage.getAttribute("data-selection-material"), "archive", "Held navigation never swaps to glass materials");
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.selectionPhase === "ready");
  assert.equal(await stage.getAttribute("data-selection-material"), "archive", "Settled selections retain the original array color");
  assert.equal(await stage.getAttribute("data-top-color"), "#969894");
  assert.equal(Number(await stage.getAttribute("data-model-builds")), buildsBefore, "Rapid browsing never rebuilds hidden glass models or cover canvases");
  await page.getByRole("button", { name: "開啟選單", exact: true }).click();
  await page.locator('.nav-drawer [data-lab-settings-open]').click();
  await page.getByText("動態效果精細設定", { exact: true }).click();
  await page.locator('[data-lab-effect="idleWave"]').check();
  await page.getByRole("button", { name: "關閉展示設定", exact: true }).click();
  await page.waitForFunction(() => +document.querySelector(".lab-stage").dataset.breathing > .75);
  const breathBefore = await stage.getAttribute("data-wave");
  await page.waitForFunction(before => document.querySelector(".lab-stage").dataset.wave !== before, breathBefore);
  await page.getByRole("button", { name: "開啟作品", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.selectionMaterial === "glass");
  await writeFile("artifacts/work-tracking-proof.json", JSON.stringify({ heldMaxError: Math.max(...held.map(n => n.error)), draggedMaxError: Math.max(...dragged.map(n => n.error)), medianFrameDelta: dt[Math.floor(dt.length / 2)], held, dragged }, null, 2));
  await context.close();
}
