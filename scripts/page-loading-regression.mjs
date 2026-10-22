import assert from "node:assert/strict";
export async function pageLoadingRegression({ browser, origin }) {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  let releaseScene;
  const sceneGate = new Promise(resolve => { releaseScene = resolve; });
  let sceneRequested;
  const requested = new Promise(resolve => { sceneRequested = resolve; });
  await page.route(/\/src\/lib\/work-lab\/scene\.ts(?:\?|$)/, async route => {
    sceneRequested();
    await sceneGate;
    await route.continue();
  });
  try {
    await page.goto(`${origin}/work/`, { waitUntil: "domcontentloaded" });
    await Promise.race([requested, new Promise((_, reject) => setTimeout(() => reject(Error("Scene request did not start")), 10000))]);
    await page.locator('[data-page-loader]').waitFor({ state: "visible" });
    assert.equal(await page.locator("#public-site").isVisible(), false, "Server content stays covered while the 3D module loads");
    await page.screenshot({ path: "artifacts/page-loading.png" });
    releaseScene();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator('.lab-stage').getAttribute('data-ready'), "true");
    assert.equal(await page.locator('.lab-boot:not([data-page-loader])').isVisible(), false, "Work does not play a second boot after page loading");
    assert.equal(await page.getByRole('button', { name: /略過開場/ }).count(), 0);
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    let releaseHome;
    const homeGate = new Promise(resolve => { releaseHome = resolve; });
    await page.route(`${origin}/`, async route => { await homeGate; await route.continue(); });
    await page.locator('.nav-drawer a[data-page-target="home"]').evaluate(link => link.click());
    assert.equal(await page.locator('body').getAttribute('data-page-state'), "leaving");
    assert.equal(await page.locator("#public-site").isVisible(), false, "The outgoing page is covered before navigation starts");
    releaseHome();
    await page.waitForURL(`${origin}/`);
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("#public-site").evaluate(element => element.inert), false);
    assert.equal(await page.locator('.mission-card').getAttribute('data-page-target'), 'work');
    assert.equal(await page.locator('.mission-link').innerText(), '作品');
    assert.equal(await page.locator('[data-element-key="work-observatory"]').count(), 0);
    // Hidden author layers have no first visible frame to wait for.
    let releaseHidden;
    const hiddenGate = new Promise(resolve => { releaseHidden = resolve; });
    await page.route(/\/src\/lib\/work-lab\/scene\.ts(?:\?|$)/, async route => { await hiddenGate; await route.continue(); });
    await page.goto(`${origin}/work/`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: ".lab-stage { display:none!important; }" });
    releaseHidden();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("#public-site").evaluate(element => element.inert), false, "History restores usable content");
    // Resource failure settles into the existing image fallback instead of trapping the loader.
    await page.route(/\/assets\/lunar-landscape\.webp/, route => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.unroute(/\/assets\/lunar-landscape\.webp/);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let releaseArtwork;
    const artworkGate = new Promise(resolve => { releaseArtwork = resolve; });
    await page.route(/\/assets\/lunar-(?:landscape|dawn-light)\.webp/, async route => { await artworkGate; await route.continue(); });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('[data-page-loader][data-visible="true"]').waitFor();
    assert.equal(await page.locator("#public-site").isVisible(), false, 'Full motion also waits for the actual image');
    await page.screenshot({ path: "artifacts/global-boot-animation.png" });
    releaseArtwork();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator('[data-page-loader]').getAttribute('data-boot-duration'), null, 'No fixed animation duration delays a prepared page');
    assert.equal(await page.locator('[data-page-loader]').getAttribute('data-prepared'), 'true');
  } finally { releaseScene(); await page.close(); }
}
