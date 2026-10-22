import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function workLabTrackingRegression({ browser, origin }) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem("outdesign.work-lab.preferences.v2", JSON.stringify({ motionPreset: "full", effects: { boot: false, idleWave: false } })));
  await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  const stage = page.locator(".lab-stage");
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.ready === "true");
  // Scene construction sets data-ready before the page removes its inert loading
  // cover. Focus/keyboard input sent during that interval never reaches the stage.
  await page.waitForFunction(() => document.body.dataset.pageState === "ready");
  // Let first-use shader compilation finish before measuring sustained input.
  await page.waitForFunction(() => +document.querySelector(".lab-stage").dataset.frames >= 12);
  await stage.focus();
  assert.equal(await stage.evaluate(el => el === document.activeElement), true);
  const buildsBefore = Number(await stage.getAttribute("data-model-builds"));
  // Record completed render frames inside the page. Re-reading data attributes
  // over the protocol counts the same (possibly pre-input) frame many times on
  // software GPUs, and those round trips also change the key-repeat cadence.
  await stage.evaluate(el => {
    const held = [];
    let started = false;
    el.addEventListener("keydown", () => { started = true; }, { once: true });
    const observer = new MutationObserver(() => {
      if (!started) return;
      held.push({ error: +el.dataset.trackingError, dt: +el.dataset.frameDelta, position: el.dataset.arrayPosition, velocity: Number(el.dataset.trackVelocity.split(",")[1]), frame: +el.dataset.frames });
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-frames"] });
    el.trackingProbe = { held, observer };
  });
  // Use a native first press/release and schedule repeat events next to the
  // renderer. A protocol round trip per repeat can take hundreds of ms under
  // SwiftShader, accidentally testing sparse taps instead of a held key.
  await page.keyboard.down("ArrowDown");
  const held = await stage.evaluate(async el => {
    for (let n = 0; n < 100; n++) {
      await new Promise(resolve => setTimeout(resolve, 25));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", repeat: true, bubbles: true, cancelable: true }));
    }
    el.trackingProbe.observer.disconnect();
    return el.trackingProbe.held;
  });
  await page.keyboard.up("ArrowDown");
  await writeFile("artifacts/work-held-proof.json", JSON.stringify({ held }, null, 2));
  assert.ok(held.length >= 12, "Held navigation must be observed across actual rendered frames");
  assert.ok(Number(await stage.getAttribute("data-movement-pulses")) > 15, "Repeated movement produces waves before selection standby completes");
  const waveOrigin = (await stage.getAttribute("data-wave-origin")).split(",").map(Number);
  const waveAhead = (await stage.getAttribute("data-wave-ahead")).split(",").map(Number);
  assert.ok(waveAhead[1] - waveOrigin[1] > 5.9, "Scrolling prepares a wave six rows ahead in the actual travel direction");
  assert.ok(Math.max(...held.slice(4).map(n => n.error)) < 1.25, "Held navigation responds within one adjacent cell instead of accumulating spring lag");
  // Software renderers may produce fewer frames than the key-repeat rate. A
  // frame after the 50 ms prediction window is correctly allowed to settle.
  // Check real rendered travel here; inter-repeat velocity is checked against
  // this same renderer function at deterministic 30/60/120 Hz in work-lab.test.ts.
  const rows = held.map(sample => Number(sample.position.split(",")[1]));
  assert.ok(Math.max(...rows) - Math.min(...rows) > 50, "Held navigation advances the rendered archive throughout the input sequence");
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
