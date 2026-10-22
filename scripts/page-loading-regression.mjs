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
    releaseScene();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator('.lab-stage').getAttribute('data-ready'), "true");
    await page.getByRole("button", { name: "開啟選單", exact: true }).click();
    let releaseHome;
    const homeGate = new Promise(resolve => { releaseHome = resolve; });
    await page.route(`${origin}/`, async route => { await homeGate; await route.continue(); });
    await page.locator('.nav-drawer a[data-page-target="home"]').evaluate(link => link.click());
    assert.equal(await page.locator('body').getAttribute('data-page-state'), "leaving");
    assert.equal(await page.locator("#public-site").isVisible(), false, "The outgoing page is covered before navigation starts");
    await page.screenshot({ path: "artifacts/page-loading.png" });
    releaseHome();
    await page.waitForURL(`${origin}/`);
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("#public-site").evaluate(element => element.inert), false);
    // Hidden author layers have no first visible frame to wait for.
    let releaseHidden;
    const hiddenGate = new Promise(resolve => { releaseHidden = resolve; });
    await page.route(/\/src\/lib\/work-lab\/scene\.ts(?:\?|$)/, async route => { await hiddenGate; await route.continue(); });
    await page.goto(`${origin}/work/`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: ".lab-stage { display:none!important; }" });
    releaseHidden();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
  } finally { releaseScene(); await page.close(); }
}
