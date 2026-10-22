import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
export async function workLabRegression({ page, api, origin }) {
  const draft = await api.store.getDraft(),
    content = structuredClone(draft.content);
  content.projects = [
    {
      id: crypto.randomUUID(),
      title: "光的切片",
      category: "設計",
      description:
        "以原創平面幾何記錄光線的層次。此封面僅用於隔離的瀏覽器驗證。",
      year: "2026",
      image: "/assets/cassette-study.svg",
      alt: "原創綠色幾何平面作品",
      url: "https://example.com/project",
      tone: "silver",
      demo: false,
    },
    {
      id: crypto.randomUUID(),
      title: "空間與留白",
      category: "開發",
      description: "第二件獨立測試作品。",
      year: "2026",
      image: "/assets/cassette-study.svg",
      alt: "原創幾何測試封面",
      url: "",
      tone: "silver",
      demo: false,
    },
  ];
  content.projects.push({
    ...content.projects[0],
    id: crypto.randomUUID(),
    title: "層疊影像",
    url: "",
  });
  const next = await api.store.saveDraft(content, draft.revision);
  await api.store.publish(next.revision, crypto.randomUUID());
  await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  const root = page.locator("[data-work-lab]"),
    stage = page.locator(".lab-stage");
  await root
    .locator("[data-lab-browse-title]")
    .filter({ hasText: "光的切片" })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector(".lab-stage")?.dataset.ready === "true",
  );
  await page.waitForFunction(
    () => document.querySelector(".lab-stage")?.dataset.imageState === "loaded",
  );
  assert.equal(
    await stage.getAttribute("data-flat-image"),
    "true",
    "Artwork is a single plane inside the cassette",
  );
  console.log(
    "Archive renderer",
    await stage.evaluate((el) => ({
      software: el.dataset.softwareRenderer,
      quality: el.dataset.effectiveQuality,
    })),
  );
  assert.equal(await root.getAttribute("data-mode"), "browse");
  assert.equal(await stage.getAttribute("data-array-overlap"), "false");
  assert.equal(Number(await stage.getAttribute("data-array-cells")), 585);
  assert.deepEqual(
    await root.evaluate((el) => ({
      x: el.getBoundingClientRect().x,
      y: el.getBoundingClientRect().y,
      w: el.clientWidth,
      h: el.clientHeight,
    })),
    { x: 0, y: 0, w: 1440, h: 1080 },
    "The archive occupies the whole work page",
  );
  await root.screenshot({ path: "artifacts/work-array-desktop.png" });
  await root.getByRole("button", { name: "下一個分類", exact: true }).click();
  assert.equal(
    await root.locator("[data-lab-browse-title]").textContent(),
    "空間與留白",
  );
  await root.getByRole("button", { name: "上一個分類", exact: true }).click();
  await stage.focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await root.locator("[data-lab-browse-title]").textContent(),
    "層疊影像",
  );
  await page.keyboard.press("ArrowDown");
  assert.equal(
    await root.locator("[data-lab-browse-title]").textContent(),
    "光的切片",
    "Rows wrap inside their own category",
  );
  await page.mouse.move(250, 350);
  await page.mouse.wheel(0, -180);
  await page.waitForFunction(
    () => document.querySelector("[data-work-lab]")?.dataset.row === "1",
  );
  assert.equal(
    await root.locator("[data-lab-browse-title]").textContent(),
    "層疊影像",
  );
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await root.getByRole("button", { name: "開啟作品", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("[data-work-lab]")?.dataset.revealing === "false",
  );
  await root.screenshot({ path: "artifacts/work-glass-detail.png" });
  await root
    .getByRole("button", { name: "360° 卡帶檢視 ↗", exact: true })
    .click();
  await root.getByRole("button", { name: "拆解構件 ＋", exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector(".lab-stage")?.dataset.explode) > 0.95,
  );
  await root.getByRole("button", { name: "磨砂", exact: true }).click();
  assert.equal(
    await root
      .getByRole("button", { name: "磨砂", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await root.getByRole("button", { name: "清晰", exact: true }).click();
  await root.getByRole("button", { name: "返回作品資料", exact: true }).click();
  await root.getByRole("tab", { name: "卡帶結構", exact: true }).click();
  await root.locator('[data-lab-part="2"]').click();
  assert.equal(await root.getAttribute("data-mode"), "inspect");
  const before = await stage.getAttribute("data-camera-position"),
    b = await stage.boundingBox();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5 + 60, b.y + b.height * 0.5 + 30, {
    steps: 6,
  });
  await page.mouse.up();
  await page.waitForFunction(
    (old) =>
      document.querySelector(".lab-stage")?.dataset.cameraPosition !== old,
    before,
  );
  await root.screenshot({
    path: "artifacts/work-glass-exploded.png",
  });
  await root.getByRole("button", { name: "重設視角 ↗", exact: true }).click();
  await root.getByRole("button", { name: "返回作品資料", exact: true }).click();
  await root.getByRole("button", { name: "開啟展示設定", exact: true }).click();
  await root.locator('[data-lab-setting="theme"]').selectOption("dark");
  await page.waitForFunction(() => document.querySelector(".lab-stage")?.dataset.cassetteTheme === "dark");
  assert.equal(await stage.getAttribute("data-shell-color"), "#11161c", "Theme changes the actual cassette material, including the archive array");
  await root.getByRole("button", { name: "關閉展示設定", exact: true }).click();
  await root.screenshot({ path: "artifacts/work-glass-dark.png" });
  await root.getByRole("button", { name: "開啟展示設定", exact: true }).click();
  await root.locator('[data-lab-setting="theme"]').selectOption("light");
  await root.locator('[data-lab-setting="quality"]').selectOption("high");
  await root.getByRole("button", { name: "關閉展示設定", exact: true }).click();
  await page.waitForTimeout(1200);
  await root
    .getByRole("button", { name: "360° 卡帶檢視 ↗", exact: true })
    .click();
  await root.getByRole("button", { name: "− 一鍵重組", exact: true }).click();
  await root.getByRole("button", { name: "返回作品資料", exact: true }).click();
  await root.getByRole("tab", { name: "作品介紹", exact: true }).click();
  await root.screenshot({
    path: "artifacts/work-glass-light.png",
  });
  await root.getByRole("button", { name: "收藏作品 ＋", exact: true }).click();
  await root.getByRole("button", { name: "檢視收藏作品", exact: true }).click();
  assert.equal(await root.locator("[data-lab-result]").count(), 1);
  await root.getByRole("button", { name: "關閉作品索引", exact: true }).click();
  await root.getByRole("button", { name: "搜尋作品", exact: true }).click();
  await root.locator("[data-lab-search]").fill("空間");
  assert.equal(await root.locator("[data-lab-result]").count(), 1);
  await root.locator("[data-lab-result]").click();
  assert.equal(
    await root.locator("[data-lab-title]").textContent(),
    "空間與留白",
  );
  await stage.focus();
  await page.keyboard.press("Escape");
  assert.equal(await root.getAttribute("data-mode"), "browse");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await root.getAttribute("data-mode"), "detail");
  const download = page.waitForEvent("download");
  await root
    .getByRole("button", { name: "匯出作品資料 ↓", exact: true })
    .click();
  assert.match((await download).suggestedFilename(), /^NO\.\d{3}\.txt$/);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Work cassette overflow ${width}`,
    );
    if (width === 390) {
      await root.screenshot({ path: "artifacts/work-glass-mobile.png" });
      await root
        .getByRole("button", { name: "360° 卡帶檢視 ↗", exact: true })
        .click();
      await page.waitForTimeout(200);
      const beforeTouch = await stage.getAttribute("data-camera-position");
      const touch = await page.context().newCDPSession(page);
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 5,
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: 140, y: 320 },
          { x: 250, y: 320 },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: 90, y: 290 },
          { x: 300, y: 360 },
        ],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await page.waitForFunction(
        (old) =>
          document.querySelector(".lab-stage")?.dataset.cameraPosition !== old,
        beforeTouch,
      );
      await root.screenshot({ path: "artifacts/work-viewer-mobile.png" });
      await root
        .getByRole("button", { name: "返回作品資料", exact: true })
        .click();
      await root.locator('[data-lab-action="back"]').click();
      await root.screenshot({ path: "artifacts/work-array-mobile.png" });
      const beforeSwipe = [
        await root.getAttribute("data-lane"),
        await root.getAttribute("data-row"),
      ].join(":");
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 140, y: 230 }],
      });
      for (let i = 1; i <= 5; i++)
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 140 + i * 20, y: 230 + i * 8 }],
        });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      assert.notEqual(
        [
          await root.getAttribute("data-lane"),
          await root.getAttribute("data-row"),
        ].join(":"),
        beforeSwipe,
        "Touch drag navigates projected archive tracks",
      );
      await touch.send("Emulation.setTouchEmulationEnabled", {
        enabled: false,
      });
      await touch.detach();
      await root.getByRole("button", { name: "開啟作品", exact: true }).click();
    }
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  // Exercise the real timeline in addition to the reduced-motion path.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await root.getByRole("button", { name: "開啟展示設定", exact: true }).click();
  await root.locator('[data-lab-setting="quality"]').selectOption("medium");
  await root.locator('[data-lab-setting="motion"]').check();
  await root.locator('[data-lab-setting="sound"]').check();
  await root.locator('[data-lab-setting="ambient"]').check();
  await root.getByRole("button", { name: "關閉展示設定", exact: true }).click();
  // Test skip handlers in one event task; a slow GPU may finish a short boot
  // while Playwright waits for actionability between two protocol calls.
  await root.evaluate((element) => {
    element.querySelector('[data-lab-action="replay"]').click();
    if (element.querySelector(".lab-boot").hidden)
      throw new Error("Boot did not open");
    element.querySelector('[data-lab-action="skip"]').click();
    if (!element.querySelector(".lab-boot").hidden)
      throw new Error("Skip did not close boot");
  });
  await root.getByRole("button", { name: "重播開場", exact: true }).click();
  await root.locator(".lab-boot").waitFor({ state: "hidden", timeout: 15000 });
  await root.locator('[data-lab-action="back"]').click();
  await stage.focus();
  const motionProof = [];
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"]) {
    await page.waitForTimeout(1400);
    const before = await stage.getAttribute("data-array-position");
    await page.keyboard.press(key);
    const target = [
      Number(await root.getAttribute("data-lane")),
      Number(await root.getAttribute("data-row")),
    ];
    const axis = key === "ArrowRight" || key === "ArrowLeft" ? 0 : 1;
    await page.waitForFunction(
      ({ before, target, axis }) => {
        const values =
          document
            .querySelector(".lab-stage")
            ?.getAttribute("data-array-position")
            ?.split(",")
            .map(Number) || [];
        return (
          Math.abs(values[axis] - Number(before.split(",")[axis])) > 0.002 &&
          Math.abs(values[axis] - target[axis]) > 0.002
        );
      },
      { before, target, axis },
    );
    const middle = await stage.getAttribute("data-array-position");
    await page.waitForFunction(
      ({ target, axis }) => {
        const values =
          document
            .querySelector(".lab-stage")
            ?.getAttribute("data-array-position")
            ?.split(",")
            .map(Number) || [];
        return Math.abs(values[axis] - target[axis]) < 0.03;
      },
      { target, axis },
    );
    motionProof.push({
      key,
      before,
      middle,
      target,
      settled: await stage.getAttribute("data-array-position"),
    });
  }
  await writeFile(
    "artifacts/work-motion-proof.json",
    JSON.stringify(motionProof, null, 2),
  );
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () =>
      document.querySelector("[data-work-lab]")?.dataset.revealing === "false",
  );
  await root.getByRole("button", { name: "開啟展示設定", exact: true }).click();
  await root
    .locator('[data-lab-setting="motionPreset"]')
    .selectOption("system");
  await root.getByRole("button", { name: "關閉展示設定", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(
    () => document.querySelector("[data-work-lab]")?.dataset.motion === "false",
  );
  await page.setViewportSize({ width: 1440, height: 400 });
  await root.evaluate((el) => {
    el.style.transform = "translateY(200vh)";
  });
  await page.waitForFunction(() => {
    const stage = document.querySelector(".lab-stage");
    return stage?.dataset.visible === "false" && stage.dataset.renderState === "paused";
  });
  const idleFrames = await stage.getAttribute("data-frames");
  await page.waitForTimeout(200);
  assert.equal(
    await stage.getAttribute("data-frames"),
    idleFrames,
    "Offscreen scene stops rendering",
  );
  await root.evaluate((el) => {
    el.style.transform = "";
  });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    "artifacts/accessibility-work-lab.json",
    JSON.stringify(axe.violations, null, 2),
  );
  assert.deepEqual(
    axe.violations.filter((v) => ["critical", "serious"].includes(v.impact)),
    [],
    "Work lab accessibility",
  );
  // No-WebGL retains real project information and a flat-image fallback.
  const fallback = await page.context().newPage();
  await fallback.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl" || type === "webgl2") return null;
      return get.call(this, type, ...args);
    };
  });
  await fallback.goto(`${origin}/work/`, { waitUntil: "networkidle" });
  await fallback.locator('[data-work-lab][data-engine="fallback"]').waitFor();
  assert.equal(
    await fallback.locator("[data-lab-browse-title]").textContent(),
    "光的切片",
  );
  await fallback.locator("[data-work-lab]").screenshot({
    path: "artifacts/work-glass-fallback.png",
  });
  await fallback.close();
  await page.evaluate(() => {
    localStorage.removeItem("outdesign.work-lab.preferences.v2");
    localStorage.removeItem("outdesign.work-lab.saved.v1");
  });
}
