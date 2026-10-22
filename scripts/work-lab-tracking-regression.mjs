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
  const held = [];
  // Actual repeated keydown messages keep the key held throughout the run.
  for (let n = 0; n < 100; n++) {
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(25);
    held.push(await stage.evaluate(el => ({ error: +el.dataset.trackingError, dt: +el.dataset.frameDelta, position: el.dataset.arrayPosition })));
  }
  await page.keyboard.up("ArrowDown");
  assert.ok(Math.max(...held.slice(4).map(n => n.error)) < 2.4, "Held navigation keeps the camera track within two adjacent cells");
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
  await writeFile("artifacts/work-tracking-proof.json", JSON.stringify({ heldMaxError: Math.max(...held.map(n => n.error)), draggedMaxError: Math.max(...dragged.map(n => n.error)), medianFrameDelta: dt[Math.floor(dt.length / 2)], held, dragged }, null, 2));
  await context.close();
}
