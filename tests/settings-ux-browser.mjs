import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { startLocalApi } from '../server/local-api.mjs';

await mkdir('artifacts', {recursive:true});
const directory = await mkdtemp(join(tmpdir(), 'outdesign-settings-ux-'));
const probe = createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const api = await startLocalApi({ directory, port: 0, allowedOrigins: [origin] });
const astro = JSON.parse(await readFile('node_modules/astro/package.json', 'utf8'));
const child = spawn(process.execPath, [join('node_modules/astro', astro.bin.astro), 'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)], {
  env: { ...process.env, PUBLIC_API_URL: api.url + '/api', SITE_URL: origin, BASE_PATH: '/', CONTENT_VERSION: '', CONTENT_REQUIRED: 'false' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
let browser;
const result = { checks: [], runtimeErrors: [] };
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, output.slice(-2000));
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined), headless: true });
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width === 390, isMobile: width === 390 });
    const page = await context.newPage();
    page.on('pageerror', error => result.runtimeErrors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('outdesign.site.motion.v1', 'reduced'));
    for (const route of ['about', 'work']) {
      await page.goto(`${origin}/${route}/`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.body.dataset.pageState === 'ready', undefined, { timeout: 60000 });
      await page.getByRole('button', { name: '開啟選單', exact: true }).click();
      await page.locator(`.nav-drawer [${route === 'work' ? 'data-lab-settings-open' : 'data-site-settings'}]`).click();
      const dialog = page.locator('.experience-settings');
      await dialog.waitFor({ state: 'visible' });
      for (const theme of ['light', 'dark']) {
        await page.locator(route === 'work' ? '[data-lab-setting="theme"]' : '[data-site-theme-select]').selectOption(theme);
        await page.waitForFunction(theme => document.querySelector('.site')?.dataset.siteTheme === theme, theme);
        const contrast = await dialog.evaluate(el => {
          const ctx = document.createElement('canvas').getContext('2d');
          const rgba = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
          const luminance = rgb => rgb.slice(0, 3).map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, value, n) => sum + value * [.2126, .7152, .0722][n], 0);
          const ratio = (a, b) => { const aa = luminance(rgba(a)), bb = luminance(rgba(b)); return (Math.max(aa, bb) + .05) / (Math.min(aa, bb) + .05); };
          const background = element => { for (let node = element; node; node = node.parentElement) { const c = getComputedStyle(node).backgroundColor; if (rgba(c)[3] > 250) return c; } return '#ffffff'; };
          const selectors = ['header h2,header h3', '.settings-intro', 'label', 'select', 'select option', 'header > button', '.volume-heading output', '.volume-presets button', '.volume-presets button span', '.volume-scale'];
          const samples = selectors.flatMap(selector => [...el.querySelectorAll(selector)].filter(node => node.getBoundingClientRect().width > 0 || node.tagName === 'OPTION').map(node => ({ node: node.tagName, text: node.textContent.trim().slice(0, 30), color: getComputedStyle(node).color, background: background(node), contrast: ratio(getComputedStyle(node).color, background(node)) })));
          const control = el.querySelector('select');
          const cs = getComputedStyle(control);
          const style = getComputedStyle(el);
          return { samples, colorScheme: style.colorScheme, controlContrast: ratio(cs.borderTopColor, cs.backgroundColor), trackContrast: ratio(style.getPropertyValue('--pref-track'), style.getPropertyValue('--pref-surface')), accentContrast: ratio(style.getPropertyValue('--pref-accent'), style.getPropertyValue('--pref-surface')) };
        });
        assert.ok(contrast.samples.every(n => n.contrast >= 4.5), `${route} ${theme} ${width}: ${JSON.stringify(contrast.samples.filter(n => n.contrast < 4.5))}`);
        assert.ok(contrast.controlContrast >= 3, 'Control boundaries remain visible');
        assert.ok(contrast.trackContrast >= 3, 'Range track remains visible');
        assert.equal(contrast.colorScheme, theme);
        const axe = await new AxeBuilder({ page }).include('.experience-settings').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        assert.deepEqual(axe.violations.filter(n => ['serious', 'critical'].includes(n.impact)), []);
        await dialog.screenshot({ path: `artifacts/settings-${route}-${theme}-${width}.png` });
        if (route === 'work') {
          const volume = page.getByRole('slider', { name: '音場強度', exact: true });
          const height = await volume.evaluate(el => el.getBoundingClientRect().height);
          assert.ok(height >= 44);
          for (const [position, label] of [[0, '5×'], [50, '10×'], [100, '20×']]) {
            await volume.fill(String(position));
            assert.equal(await volume.getAttribute('aria-valuetext'), label);
            assert.equal(await volume.evaluate(el => el.style.getPropertyValue('--range-progress')), `${position}%`);
            assert.equal(await page.locator(`[data-lab-volume-preset="${position === 0 ? 1.5 : position === 50 ? 3 : 6}"]`).getAttribute('aria-pressed'), 'true');
          }
          await volume.focus();
          await page.keyboard.press('Home');
          assert.equal(await volume.inputValue(), '0');
          await page.keyboard.press('ArrowRight');
          assert.equal(await volume.inputValue(), '1');
          await page.keyboard.press('End');
          assert.equal(await volume.getAttribute('aria-valuetext'), '20×');
          const focus = await volume.evaluate(el => ({ visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineWidth }));
          assert.equal(focus.visible, true);
          assert.equal(focus.outline, '2px');
          if (width === 390) {
            const bounds = await volume.boundingBox();
            await page.touchscreen.tap(bounds.x + bounds.width * .25, bounds.y + bounds.height / 2);
            const position = Number(await volume.inputValue());
            assert.ok(position >= 15 && position <= 35, 'Touch can set an intermediate value');
          }
          await page.locator('[data-lab-volume-preset="3"]').click();
          await dialog.screenshot({ path: `artifacts/settings-work-${theme}-${width}-volume.png` });
        }
        result.checks.push({ route, theme, width, contrast, seriousViolations: 0 });
        console.log(`PASS settings ${route}/${theme}/${width}, min text ${Math.min(...contrast.samples.map(n => n.contrast)).toFixed(2)}:1, border ${contrast.controlContrast.toFixed(2)}:1`);
      }
      await page.getByRole('button', { name: route === 'work' ? '關閉展示設定' : '關閉全站設定', exact: true }).click();
    }
    await context.close();
  }
  assert.deepEqual(result.runtimeErrors, []);
  await writeFile('artifacts/settings-ux-results.json', JSON.stringify(result, null, 2));
} catch(error) {
  result.error = error.message;
  result.serverOutput = output.slice(-3000);
  await writeFile('artifacts/settings-ux-failure.json', JSON.stringify(result, null, 2));
  throw error;
} finally {
  await browser?.close();
  child.kill();
  await api.close();
  assert.ok(basename(directory).startsWith('outdesign-settings-ux-'));
  await rm(directory, { recursive: true, force: true });
}

