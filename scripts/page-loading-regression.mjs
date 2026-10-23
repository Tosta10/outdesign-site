import assert from "node:assert/strict";
export async function pageLoadingRegression({ browser, origin }) {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const releaseGates = [];
  let releaseScene;
  const sceneGate = new Promise(resolve => { releaseScene = resolve; });
  releaseGates.push(releaseScene);
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
    releaseGates.push(releaseHome);
    await page.route(`${origin}/`, async route => { await homeGate; await route.continue(); });
    await page.locator('.nav-drawer a[data-page-target="home"]').evaluate(link => link.click());
    assert.equal(await page.locator('body').getAttribute('data-page-state'), "leaving");
    assert.equal(await page.locator("#public-site").isVisible(), false, "The outgoing page is covered before navigation starts");
    releaseHome();
    await page.waitForURL(`${origin}/`);
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("#public-site").evaluate(element => element.inert), false);
    assert.equal(await page.locator('.folio-work-link').getAttribute('data-page-target'), 'work');
    assert.equal(await page.locator('.folio-work-cta').innerText(), '進入作品');
    assert.equal(await page.locator('[data-element-key="work-observatory"]').count(), 0);
    // Hidden author layers have no first visible frame to wait for.
    let releaseHidden;
    const hiddenGate = new Promise(resolve => { releaseHidden = resolve; });
    releaseGates.push(releaseHidden);
    await page.route(/\/src\/lib\/work-lab\/scene\.ts(?:\?|$)/, async route => { await hiddenGate; await route.continue(); });
    await page.goto(`${origin}/work/`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: ".lab-stage { display:none!important; }" });
    releaseHidden();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    await page.goBack({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("#public-site").evaluate(element => element.inert), false, "History restores usable content");
    // Use a first-screen custom-image fixture: the default typographic homepage
    // needs no decorative image, but author-selected media must still preload.
    const imageUrl = `${origin}/regression-preload.svg`;
    await page.route(`${origin}/`, async route => {
      const response = await route.fetch();
      const source = await response.text();
      const image = `<img data-regression-preload src="${imageUrl}" alt="" width="16" height="16" style="position:fixed;top:120px;left:30px;width:16px;height:16px">`;
      const body = source.replace(/(<main\b[^>]*>)/, `$1${image}`);
      assert.ok(body.includes("data-regression-preload"), "The preload fixture is inside the public site");
      await route.fulfill({ response, body });
    });
    // A failed image request settles instead of trapping the loader.
    await page.route(imageUrl, route => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("[data-regression-preload]").evaluate(image => image.naturalWidth), 0);
    await page.unroute(imageUrl);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    let releaseArtwork;
    const artworkGate = new Promise(resolve => { releaseArtwork = resolve; });
    releaseGates.push(releaseArtwork);
    let imageRequested;
    const requestedImage = new Promise(resolve => { imageRequested = resolve; });
    await page.route(imageUrl, async route => {
      imageRequested();
      await artworkGate;
      await route.fulfill({ contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#55695b"/></svg>' });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await Promise.race([requestedImage, new Promise((_, reject) => setTimeout(() => reject(Error("Custom preload image request did not start")), 10000))]);
    await page.locator('[data-page-loader][data-visible="true"]').waitFor();
    assert.equal(await page.locator("#public-site").isVisible(), false, 'Full motion also waits for the actual image');
    await page.screenshot({ path: "artifacts/global-boot-animation.png" });
    releaseArtwork();
    await page.waitForFunction(() => document.body.dataset.pageState === "ready");
    assert.equal(await page.locator("[data-regression-preload]").evaluate(image => image.naturalWidth), 16,
      "The loader releases the page after custom media has decoded");
    assert.equal(await page.locator('[data-page-loader]').getAttribute('data-boot-duration'), null, 'No fixed animation duration delays a prepared page');
    assert.equal(await page.locator('[data-page-loader]').getAttribute('data-prepared'), 'true');
  } finally { releaseGates.forEach(release => release()); await page.close(); }
}
