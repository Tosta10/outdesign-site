import { createServer } from "node:http";
import { createServer as probePort } from "node:net";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import lighthouse from "lighthouse";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const base = (process.env.BASE_PATH || "/").replace(/\/?$/, "/");
const mime = {
  ".html": "text/html;charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  try {
    const requested = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const pathname =
      base !== "/" && requested.startsWith(base)
        ? "/" + requested.slice(base.length)
        : requested;
    const file = resolve(
      root,
      "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
    );
    if (!file.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control":
        extname(file) === ".html"
          ? "no-cache"
          : "public,max-age=31536000,immutable",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}${base}`;
const probe = probePort();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const debugPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
let browser;
try {
  await mkdir("artifacts", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    channel:
      process.env.PLAYWRIGHT_CHANNEL ||
      (process.platform === "win32" ? "msedge" : undefined),
    args: [`--remote-debugging-port=${debugPort}`],
  });
  const result = await lighthouse(url, {
    port: debugPort,
    output: ["json", "html"],
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  });
  await writeFile("artifacts/lighthouse.json", result.report[0]);
  await writeFile("artifacts/lighthouse.html", result.report[1]);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/home-hero.png" });
  const initialScripts = await page
    .locator("script[src]")
    .evaluateAll((elements) => elements.map((e) => new URL(e.src).pathname));
  const assets = [];
  for (const file of await readdir("dist/_astro")) {
    const path = resolve("dist/_astro", file);
    if (!(await stat(path)).isFile()) continue;
    const data = await readFile(path);
    assets.push({
      file,
      bytes: data.length,
      gzipBytes: gzipSync(data).length,
      initiallyLoaded: initialScripts.some((p) => p.endsWith(file)),
    });
  }
  const lhr = result.lhr;
  const metrics = {
    source:
      "Local production static build; Lighthouse simulated mobile, not field data",
    scores: Object.fromEntries(
      Object.entries(lhr.categories).map(([key, value]) => [
        key,
        Math.round(value.score * 100),
      ]),
    ),
    lcpMs: Math.round(lhr.audits["largest-contentful-paint"].numericValue),
    cls: lhr.audits["cumulative-layout-shift"].numericValue,
    totalBlockingTimeMs: Math.round(
      lhr.audits["total-blocking-time"].numericValue,
    ),
    inp: "Requires real-user field measurement after deployment",
    initialJavaScriptGzipBytes: assets
      .filter((a) => a.initiallyLoaded && a.file.endsWith(".js"))
      .reduce((sum, a) => sum + a.gzipBytes, 0),
    assets,
  };
  await writeFile(
    "artifacts/performance.json",
    JSON.stringify(metrics, null, 2),
  );
  console.log(JSON.stringify(metrics, null, 2));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
