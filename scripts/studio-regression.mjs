import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { createCanvasNode } from "../src/lib/workspace.ts";

export async function studioRegression({
  page,
  api,
  settleCanvas,
  password1,
  password2,
}) {
  const button = (name) => page.getByRole("button", { name, exact: true });
  const label = (name) => page.getByLabel(name, { exact: true });
  const tab = (name) => page.getByRole("tab", { name, exact: true });
  const undo = async () => {
    await button("復原上一步").click();
    await settleCanvas();
  };
  const selectLayer = async (name) => {
    await button(`選取圖層：${name}`).click();
    await settleCanvas();
  };
  const gesture = async (locator, dx, dy) => {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    assert.ok(b);
    await page.mouse.move(
      b.x + Math.min(b.width / 2, 5),
      b.y + Math.min(b.height / 2, 5),
    );
    await page.mouse.down();
    await page.mouse.move(
      b.x + Math.min(b.width / 2, 5) + dx,
      b.y + Math.min(b.height / 2, 5) + dy,
      { steps: 10 },
    );
    await page.mouse.up();
    await settleCanvas();
  };
  // Compare the real website and author canvas at identical logical widths.
  const visitor = await page.context().newPage();
  await visitor.goto(page.url(), { waitUntil: "networkidle" });
  const layout = (el) => {
    const s = getComputedStyle(el);
    return [s.position, s.width, s.padding, s.fontSize, s.gridTemplateColumns, s.flexDirection];
  };
  for (const width of [1440, 768, 390]) {
    await visitor.setViewportSize({ width, height: 1080 });
    await label("畫布裝置").selectOption(String(width));
    await settleCanvas();
    for (const selector of [".hero", ".mission-card", ".mission-card h2", ".hero h1", ".site-header"])
      assert.deepEqual(await page.locator(".editor-canvas " + selector).evaluate(layout), await visitor.locator(selector).evaluate(layout), `Public/editor parity at ${width}: ${selector}`);
  }
  await visitor.close();
  await label("畫布裝置").selectOption("auto");
  const source = page.locator(
    '.editor-canvas [data-element-key="field-about-title"]',
  );
  await source.click();
  await label("原始元素內容").fill("原始文字也能獨立編輯");
  await settleCanvas();
  assert.equal(await source.textContent(), "原始文字也能獨立編輯");
  await undo();
  const hoverTarget = page.locator(
    '.editor-canvas [data-element-key="field-hero-line1"]',
  );
  await hoverTarget.hover();
  assert.equal(
    await hoverTarget.evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(77, 163, 255)",
  );
  await selectLayer("介紹卡片");
  await page
    .locator(".editor-canvas .mission-card")
    .hover({ position: { x: 5, y: 5 } });
  assert.equal(
    await page
      .locator(".editor-canvas .mission-card")
      .evaluate((el) => getComputedStyle(el).outlineColor),
    "rgb(38, 132, 255)",
  );
  // Direct pointer drag of a built-in card makes one undo step.
  const card = page.locator(".editor-canvas .mission-card");
  await card.scrollIntoViewIfNeeded();
  const cardBefore = await card.boundingBox();
  await gesture(card, 40, 24);
  const cardAfter = await card.boundingBox();
  assert.ok(Math.abs(cardAfter.x - cardBefore.x - 40) <= 2, "No horizontal layout jump after release");
  assert.ok(Math.abs(cardAfter.y - cardBefore.y - 24) <= 2, "No vertical layout jump after release");
  await tab("佈局").click();
  assert.ok(Number(await label("水平位移").inputValue()) >= 32);
  assert.equal(await page.locator(".editor-canvas .mission-card").evaluate((el) => getComputedStyle(el).position), "absolute", "Dragging preserves the card's original positioning");
  await undo();
  await page.locator(".editor-toolstrip").click({ position: { x: 2, y: 2 } });
  await page.keyboard.down("Alt");
  await page.locator(".editor-canvas").hover({ position: { x: 15, y: 15 } });
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("Alt");
  assert.ok(Number(await label("畫布縮放").inputValue()) > 1, "Alt-wheel zooms the canvas");
  await page.keyboard.press("Control+0");
  assert.equal(await label("畫布縮放").inputValue(), "1");
  await label("畫布裝置").selectOption("390");
  await settleCanvas();
  assert.equal(await card.evaluate((el) => getComputedStyle(el).position), "relative");
  assert.equal(await page.locator(".editor-canvas .hero").evaluate((el) => getComputedStyle(el).flexDirection), "column");
  await label("畫布裝置").selectOption("auto");
  await settleCanvas();
  await button("刪除選取圖層").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .mission-card:visible").count(),
    0,
  );
  await button("復原此圖層").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .mission-card:visible").count(),
    1,
  );
  await selectLayer("介紹卡片");
  await gesture(button("拖曳縮放選取物件"), 24, 16);
  await tab("佈局").click();
  assert.ok(Number(await label("物件寬度").inputValue()) > 100);
  await undo();
  await button("鎖定圖層：介紹卡片").click();
  await settleCanvas();
  assert.equal(await button("刪除選取圖層").isDisabled(), true);
  await button("解鎖圖層：介紹卡片").click();
  await settleCanvas();
  const leftWidth = await page
    .locator(".editor-layers")
    .evaluate((el) => el.clientWidth);
  await gesture(
    page.getByRole("separator", { name: "調整左側面板寬度" }),
    40,
    0,
  );
  assert.ok(
    (await page.locator(".editor-layers").evaluate((el) => el.clientWidth)) >
      leftWidth + 20,
  );
  const rightWidth = await page
    .locator(".editor-panel")
    .evaluate((el) => el.clientWidth);
  await gesture(
    page.getByRole("separator", { name: "調整右側面板寬度" }),
    -35,
    0,
  );
  assert.ok(
    (await page.locator(".editor-panel").evaluate((el) => el.clientWidth)) >
      rightWidth + 20,
  );
  // Restore ample canvas width after exercising both separators.
  await gesture(
    page.getByRole("separator", { name: "調整左側面板寬度" }),
    -40,
    0,
  );
  await gesture(
    page.getByRole("separator", { name: "調整右側面板寬度" }),
    35,
    0,
  );
  await page.locator(".page-title-settings summary").click();
  await label("瀏覽器分頁名稱").fill("OutDesign Studio");
  await button("＋ 面板").click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 3);
  await label("圖層名稱").fill("自由面板");
  await page.locator(".assembly-panel summary").click();
  await label("組裝名稱").fill("資訊組裝");
  await button("儲存為組裝").click();
  await page.getByText("顏色、邊框與效果", { exact: true }).click();
  await label("面板邊框色").fill("#4455aa");
  await label("面板邊框粗細").fill("2");
  await label("面板懸停效果").selectOption("glow");
  await settleCanvas();
  const beforeDuplicate = await page
    .locator(".editor-canvas .canvas-node")
    .count();
  await button("複製圖層").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .canvas-node").count(),
    beforeDuplicate * 2,
  );
  await button("刪除選取圖層").click();
  await settleCanvas();
  assert.equal(
    await page.locator(".editor-canvas .canvas-node").count(),
    beforeDuplicate,
  );
  await undo();
  assert.equal(
    await page.locator(".editor-canvas .canvas-node").count(),
    beforeDuplicate * 2,
  );
  await undo();
  await label("預覽頁面").selectOption("home");
  await settleCanvas();
  await page
    .locator('.editor-canvas [data-element-key="field-hero-line1"]')
    .click();
  await label("原始元素內容").fill("讓創意，有方向。");
  await settleCanvas();
  const before = await (await fetch(api.url + "/api/public")).json();
  assert.equal(before.content.hero.line1, "把想法，");
  await page.screenshot({ path: "artifacts/editor-layers-desktop.png" });
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
  // Expanded code workspace keeps its isolated right preview, validation and X/Escape.
  await tab("代碼").click();
  const code = label("網站程式碼"),
    baseline = await code.inputValue();
  await button("展開工作區").click();
  const candidate = JSON.parse(baseline);
  candidate.about.title = "即時預覽尚未套用";
  await code.fill(JSON.stringify(candidate));
  const frame = page.frameLocator('iframe[title="代碼即時預覽"]');
  await frame
    .locator(".mission-card h2")
    .filter({ hasText: "即時預覽尚未套用" })
    .waitFor();
  assert.notEqual(
    await page.locator(".editor-canvas .mission-card h2").textContent(),
    "即時預覽尚未套用",
  );
  await code.fill("{invalid");
  await page.getByText("保留上次有效畫面", { exact: true }).waitFor();
  await code.fill(baseline);
  await button("關閉代碼工作區").click();
  // Dense layout remains editable; typing coalesces independently from replacing the scene.
  const stress = JSON.parse(baseline);
  stress.workspace.nodes = [];
  for (let i = 0; i < 33; i++) {
    const f = createCanvasNode("home"),
      t = createCanvasNode("home", "text", f.id),
      b = createCanvasNode("home", "text", f.id);
    stress.workspace.nodes.push(f, t, b);
  }
  await code.fill(JSON.stringify(stress));
  await button("驗證並套用").click();
  await settleCanvas();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 99);
  await tab("內容").click();
  await page
    .locator('.editor-canvas [data-element-key="field-hero-line1"]')
    .click();
  await page.evaluate(() => {
    window.__bench = { samples: [], longTasks: [] };
    window.__input = () => {
      const t = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          window.__bench.samples.push(performance.now() - t),
        ),
      );
    };
    document
      .querySelector(".editor-panel")
      .addEventListener("input", window.__input);
    window.__observer = new PerformanceObserver((list) =>
      window.__bench.longTasks.push(
        ...list.getEntries().map((e) => e.duration),
      ),
    );
    window.__observer.observe({ type: "longtask" });
  });
  await label("原始元素內容").pressSequentially("即時畫布測試", { delay: 10 });
  await settleCanvas();
  await page.waitForTimeout(100);
  const editorPerformance = await page.evaluate(() => {
    document
      .querySelector(".editor-panel")
      .removeEventListener("input", window.__input);
    window.__observer.disconnect();
    const values = window.__bench.samples.sort((a, b) => a - b);
    const p = (q) =>
      Math.round(
        (values[Math.max(0, Math.ceil(values.length * q) - 1)] || 0) * 10,
      ) / 10;
    return {
      source:
        "Local automated browser; 99 nodes; input to two animation frames; not field INP",
      samples: values.length,
      medianMs: p(0.5),
      p95Ms: p(0.95),
      maxMs: p(1),
      longTasksOver50ms: window.__bench.longTasks.length,
    };
  });
  await writeFile(
    "artifacts/editor-performance.json",
    JSON.stringify(editorPerformance, null, 2),
  );
  await undo();
  await undo();
  assert.equal(await page.locator(".editor-canvas .canvas-node").count(), 3);
  // Independent logic mode has no drawing/layer/inspector chrome.
  await label("切換模式").selectOption("blocks");
  await page.locator(".scratch-studio").waitFor();
  assert.equal(
    await page
      .locator(".editor-layers,.editor-toolstrip,.editor-panel")
      .count(),
    0,
  );
  await label("腳本目標物件").selectOption("element:field-hero-line1");
  await button("物件圖層 · 指定既有內容").click();
  assert.equal(await page.locator(".scratch-stack").count(), 0, "Clicking the library does not insert");
  await button("物件圖層 · 指定既有內容").dragTo(page.locator(".scratch-plane"), { targetPosition: { x: 40, y: 50 } });
  const stack = page.locator(".scratch-stack").first();
  await stack.locator(".scratch-object").dblclick();
  await label("物件腳本名稱").fill("標題互動");
  await button("完成").click();
  const dragBlock = async (name, target) => {
    await button(name).dragTo(target);
  };
  await page.frameLocator('iframe[title="積木即時預覽"]').locator(".mission-card").waitFor();
  await label("即時預覽裝置").selectOption("390");
  assert.equal(await page.frameLocator('iframe[title="積木即時預覽"]').locator(".mission-card").evaluate((el) => getComputedStyle(el).position), "relative");
  await label("即時預覽裝置").selectOption("1280");
  await label("即時預覽縮放").fill("1.5");
  assert.equal(await label("即時預覽縮放").inputValue(), "1.5");
  await page.locator(".scratch-scroll").click({ position: { x: 700, y: 350 } });
  await page.keyboard.down("Space");
  await page.mouse.down();
  await page.mouse.move(600, 350, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  assert.ok(await page.locator(".scratch-scroll").evaluate((el) => el.scrollLeft > 0 || el.scrollTop > 0), "Space pans the block workspace");
  await page.locator(".scratch-scroll").evaluate((el) => el.scrollTo(0, 0));
  await tab("變數與判斷").click();
  await dragBlock(/^變數設為/, stack.locator(".logic-drop-slot").first());
  // The nested language builds a real if/else branch, then executes it in preview.
  await stack
    .getByRole("group", { name: "編輯積木：變數設為", exact: true })
    .dblclick();
  await label("積木數值參數").fill("1");
  await button("完成").click();
  await button(/^如果變數大於等於/).dragTo(
    stack.locator(":scope > .logic-block-unit > .logic-drop-slot").last(),
  );
  await stack
    .getByRole("group", { name: "編輯積木：如果變數大於等於", exact: true })
    .waitFor();
  await tab("外觀與特效").click();
  await button(/^文字設為/).dragTo(
    stack.locator(".logic-branch .logic-drop-slot").first(),
  );
  await stack
    .getByRole("group", { name: "編輯積木：文字設為", exact: true })
    .dblclick();
  await label("積木文字參數").fill("Scratch標題");
  await button("完成").click();
  await button(/^不透明度/).dragTo(
    stack.locator(".logic-branch .logic-drop-slot").nth(1),
  );
  await stack
    .getByRole("group", { name: "編輯積木：不透明度", exact: true })
    .dblclick();
  await label("積木數值參數").fill("50");
  await button("完成").click();
  const connected = stack.locator(":scope > .logic-block-unit > .scratch-block");
  const bounds = await connected.evaluateAll((els) => els.map((el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
  assert.ok(bounds.length >= 2);
  assert.ok(Math.abs(bounds[1].top - bounds[0].bottom) <= 2, "Connected blocks touch");
  await stack.locator(".scratch-object").click();
  const scriptCount = await page.locator(".scratch-stack").count();
  await page.keyboard.press("Control+d");
  await settleCanvas();
  assert.equal(await page.locator(".scratch-stack").count(), scriptCount + 1, "Ctrl+D duplicates the selected script");
  await page.keyboard.press("Control+z");
  await settleCanvas();
  assert.equal(await page.locator(".scratch-stack").count(), scriptCount, "Ctrl+Z undoes script duplication");
  await tab("事件").click();
  await button("當 游標進入 時").dragTo(stack.locator(".scratch-event"));
  await stack.locator(".scratch-event").dblclick();
  await label("修改觸發事件").selectOption("click");
  await button("完成").click();
  await tab("流程控制").click();
  await button(/^重複執行/).dragTo(
    stack.locator(":scope > .logic-block-unit > .logic-drop-slot").last(),
  );
  await tab("移動與變形").click();
  const repeatBranch = stack.locator(".logic-branch").last();
  await button(/^水平移動/).dragTo(
    repeatBranch.locator(".logic-drop-slot").first(),
  );
  await button(/^旋轉/).dragTo(repeatBranch.locator(".logic-drop-slot").last());
  await button(/^垂直移動/).dragTo(repeatBranch.locator(".logic-drop-slot").last());
  await page.screenshot({ path: "artifacts/scratch-logic-workspace.png" });
  const logicAxe = await new AxeBuilder({ page })
    .exclude(".mini-preview-viewport")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await writeFile(
    "artifacts/accessibility-logic.json",
    JSON.stringify(logicAxe.violations, null, 2),
  );
  assert.deepEqual(
    logicAxe.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact),
    ),
    [],
    "Logic workspace accessibility",
  );
  await button("▶ 執行預覽").click();
  const runningTitle = page.locator(
    '.logic-live-preview [data-element-key="field-hero-line1"]',
  );
  await runningTitle.click();
  await page.waitForFunction(
    () =>
      document.querySelector(
        '.logic-live-preview [data-element-key="field-hero-line1"]',
      )?.textContent === "Scratch標題",
  );
  assert.equal(await runningTitle.evaluate((el) => el.style.opacity), "0.5");
  await page.waitForFunction(
    () =>
      document.querySelector(
        '.logic-live-preview [data-element-key="field-hero-line1"]',
      ) &&
      Number.parseFloat(
        document.querySelector(
          '.logic-live-preview [data-element-key="field-hero-line1"]',
        ).style.translate,
      ) === 72,
  );
  assert.equal(await runningTitle.evaluate((el) => el.style.rotate), "3deg");
  assert.equal(await runningTitle.evaluate((el) => el.style.translate), "72px 72px", "New vertical movement executes and saves through the API");
  const runtime = await page.evaluate(async () => {
    const { initLogic } = await import("/src/lib/logic-runtime.ts");
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;left:-5000px;width:320px";
    root.innerHTML = '<div class="site"><span data-element-key="runtime-target" style="display:block;translate:12px 8px;opacity:1">runtime</span></div>';
    document.body.append(root);
    const el = root.querySelector("span");
    const block = (op, amount = 1, value = "") => ({ id: crypto.randomUUID(), op, amount, value, duration: 0, children: [], otherwise: [] });
    const condition = block("if-width", 600);
    condition.children.push(block("opacity", 75));
    condition.otherwise.push(block("opacity", 25));
    const blocks = [block("set-x", 100), block("move-y", 24), block("set-y", 18), block("move", 3), block("reset-transform"), block("move-y", 5), block("text-color", 1, "#336699"), block("radius", 12), block("blur", 2), condition, block("stop"), block("opacity", 10)];
    const dispose = initLogic(root, [{ id: crypto.randomUUID(), page: "home", target: "element:runtime-target", name: "runtime", enabled: true, event: "load", key: "Enter", x: 0, y: 0, blocks }]);
    await new Promise(requestAnimationFrame);
    const actual = { translate: el.style.translate, color: el.style.color, radius: el.style.borderRadius, filter: el.style.filter, opacity: el.style.opacity };
    dispose();
    const restored = el.style.translate;
    root.remove();
    return { actual, restored };
  });
  assert.deepEqual(runtime.actual, { translate: "12px 13px", color: "rgb(51, 102, 153)", radius: "12px", filter: "blur(2px)", opacity: "0.75" });
  assert.equal(runtime.restored, "12px 8px", "Runtime cleanup restores original transforms");
  await button("關閉積木視窗").click();
  await tab("圖像匯入").click();
  await label("積木匯入圖片").setInputFiles({
    name: "logic.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJHkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.waitForFunction(
    () => document.querySelectorAll(".scratch-stack").length === 2,
  );
  await page
    .locator(".scratch-stack")
    .last()
    .locator(".scratch-object")
    .dblclick();
  await page.getByText("物件內容與外觀", { exact: true }).click();
  await label("積木圖片替代文字").fill("積木匯入圖像");
  await button("完成").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await tab("物件圖層").click();
  const touchSource = button("物件圖層 · 指定既有內容");
  await touchSource.scrollIntoViewIfNeeded();
  const touchBox = await touchSource.boundingBox();
  const scrollBox = await page.locator(".scratch-scroll").boundingBox();
  const touchCount = await page.locator(".scratch-stack").count();
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => ({ x, y, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(touchBox.x + 25, touchBox.y + 12)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(scrollBox.x + 15, scrollBox.y + 30)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await settleCanvas();
  assert.equal(await page.locator(".scratch-stack").count(), touchCount + 1, "Touch dragging creates a script");
  await page.screenshot({ path: "artifacts/scratch-mobile.png" });
  await page.keyboard.press("Control+z");
  await settleCanvas();
  assert.equal(await page.locator(".scratch-stack").count(), touchCount);
  await cdp.detach();
  await page.setViewportSize({ width: 1440, height: 1080 });
  await label("切換模式").selectOption("layers");
  await page.locator(".editor-canvas").waitFor();
  await settleCanvas();
  // Original DOM section order can be changed from the layer tree with the mouse.
  await label("預覽頁面").selectOption("about");
  await settleCanvas();
  await button("選取圖層：聯絡區塊")
    .locator("..")
    .dragTo(button("選取圖層：關於區塊").locator(".."), {
      targetPosition: { x: 80, y: 2 },
    });
  await settleCanvas();
  const aboutBox = await page.locator(".editor-canvas #about").boundingBox(),
    contactBox = await page.locator(".editor-canvas #contact").boundingBox();
  assert.ok(contactBox.y < aboutBox.y, "Original sections reorder visually");
  await page.getByRole("button", { name: "預覽", exact: true }).click();
  await page.locator(".editor-canvas [data-audio-toggle]").click();
  await page.waitForFunction(
    () => document.querySelector(".editor-canvas audio").currentTime > 0,
  );
  await page.locator(".editor-canvas [data-audio-toggle]").click();
  await button("繼續編輯").click();
  await label("預覽頁面").selectOption("work");
  await settleCanvas();
  await page.locator(".editor-canvas [data-lab-action=settings]").click();
  assert.equal(
    await page.locator(".editor-canvas .detail-dialog[open]").count(),
    0,
  );
  await tab("內容").click();
  await selectLayer("作品區塊");
  await button("新增作品").click();
  await label("作品名稱").fill("OutDesign Lab");
  await tab("媒體").click();
  await label("上傳素材").setInputFiles({
    name: "room.wav",
    mimeType: "audio/wav",
    buffer: await readFile("public/assets/ambient.wav"),
  });
  await page
    .locator(".media-item")
    .filter({ hasText: "room.wav" })
    .getByRole("button", { name: "套用", exact: true })
    .click();
  await tab("媒體").click();
  await label("上傳素材").setInputFiles({
    name: "readme.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("OutDesign attachment"),
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
  await button("關閉編輯面板").click();
  await button("開關圖層面板").click();
  await label("切換模式").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 1440, height: 1080 });
  await button("面板").click();
  await button("發布").click();
  await button("確認發布").click();
  await page
    .getByText("已發布至本機預覽，關閉編輯器後可查看。", { exact: true })
    .waitFor();
  const after = await (await fetch(api.url + "/api/public")).json();
  assert.equal(after.content.hero.line1, "讓創意，有方向。");
  assert.equal(after.content.settings.pageTitles.home, "OutDesign Studio");
  assert.equal(after.content.projects.length, 1);
  assert.equal(after.content.workspace.scripts.length, 2);
  assert.equal(
    after.content.workspace.presets,
    undefined,
    "Private assemblies stay private",
  );
  const imageAsset = after.content.workspace.nodes
    .find((n) => n.type === "image")
    .image.slice(6);
  assert.equal((await fetch(api.url + "/api/media/" + imageAsset)).status, 200);
  await button(/^發布歷史/).click();
  await button("載入草稿").click();
  await page
    .locator(".studio-notice")
    .filter({ hasText: "歷史版本已載入草稿，發布後才會更新網站。" })
    .waitFor();
  await page.getByText("所有修改已儲存", { exact: true }).waitFor();
  await Promise.all([
    page.waitForEvent("load"),
    button("登出並關閉編輯器").click(),
  ]);
  await page.waitForLoadState("networkidle");
  await button("作者模式").click();
  await label("第一組密碼").fill(password1);
  await label("第二組密碼").fill("an-intentionally-wrong-password");
  await button("進入作者模式").click();
  await page.getByRole("alert").filter({ hasText: "兩組密碼不正確" }).waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  await button("關閉作者登入").click();
  return { editorPerformance, severeEditor };
}
