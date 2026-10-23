import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
export async function experienceRegression({ browser, origin }) {
  const context = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(origin, {waitUntil:'networkidle'});
    await page.waitForFunction(() => document.body.dataset.pageState === 'ready');
    assert.equal(await page.locator('.navigation-trigger small').innerText(), '導覽');
    await page.getByRole('button', {name:'開啟選單',exact:true}).click();
    await page.getByRole('button', {name:'開啟全站設定',exact:true}).click();
    await page.getByLabel('全站配色',{exact:true}).selectOption('light');
    await page.getByRole('button',{name:'關閉全站設定',exact:true}).click();
    assert.equal(await page.locator('.editorial-site').getAttribute('data-site-theme'),'light');
    assert.equal(await page.locator('main a[data-page-target="work"]').count(),1);
    await page.screenshot({path:'artifacts/home-light-editorial.png',fullPage:true});
    await page.goto(`${origin}/work/`,{waitUntil:'networkidle'});
    await page.waitForFunction(() => document.body.dataset.pageState === 'ready');
    const desktop = await page.locator('.lab-stage').getAttribute('data-camera-position');
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(old => document.querySelector('.lab-stage').dataset.cameraPosition !== old, desktop);
    const distance = value => Math.hypot(...value.split(',').map(Number));
    const mobile = await page.locator('.lab-stage').getAttribute('data-camera-position');
    assert.ok(distance(mobile) > distance(desktop) * 1.1, 'Phone array camera is farther away than desktop');
    await page.screenshot({path:'artifacts/work-mobile-camera-wide.png'});
    await page.getByRole('button',{name:'開啟選單',exact:true}).click();
    await page.locator('.nav-drawer [data-lab-settings-open]').click();
    const slider = page.getByRole('slider',{name:'音場強度',exact:true});
    for (const [value, gain] of [['0',1.5],['50',3],['100',6]]) {
      await slider.fill(value);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('outdesign.work-lab.preferences.v2')).volume),gain);
    }
    await page.locator('[data-lab-volume-preset="3"]').click();
    assert.equal(await slider.inputValue(),'50');
    assert.ok(await slider.evaluate(element => element.getBoundingClientRect().height) >= 44,
      'The volume control provides a full touch target');
    assert.equal(await slider.evaluate(element => element.style.getPropertyValue('--range-progress')),'50%',
      'The visible range fill follows the selected volume');
    await slider.focus();
    await page.keyboard.press('Home');
    assert.equal(await slider.inputValue(),'0');
    await page.keyboard.press('ArrowRight');
    assert.equal(await slider.inputValue(),'1');
    await page.keyboard.press('End');
    assert.equal(await slider.inputValue(),'100');
    await page.locator('[data-lab-volume-preset="3"]').click();
    assert.equal(await page.locator('.experience-settings').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth),true,'Settings fit a phone viewport');
    await page.locator('.experience-settings').evaluate(dialog => { dialog.scrollTop = 0; });
    await page.screenshot({path:'artifacts/work-settings-new.png'});
    const axe = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(axe.violations.filter(v => ['critical','serious'].includes(v.impact)),[],'New preference controls remain accessible');
    await page.locator('[data-lab-setting="theme"]').selectOption('dark');
    await page.waitForFunction(() => document.querySelector('.work-lab').dataset.theme === 'dark');
    const darkAxe = await new AxeBuilder({page}).include('.experience-settings').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(darkAxe.violations.filter(v => ['critical','serious'].includes(v.impact)),[],
      'Dark preference labels and controls retain readable contrast');
    await page.screenshot({path:'artifacts/work-settings-dark.png'});
  } finally { await context.close(); }
}
