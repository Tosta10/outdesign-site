import { siteThemeRegression } from "./site-theme-regression.mjs";
import { pageLoadingRegression } from "./page-loading-regression.mjs";
import { workLabAuthorRegression } from "./work-lab-author-regression.mjs";
import { workLabTrackingRegression } from "./work-lab-tracking-regression.mjs";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { startLocalApi } from "../server/local-api.mjs";
import { workLabRegression } from "./work-lab-regression.mjs";
const directory = await mkdtemp(join(tmpdir(), "outdesign-work-lab-"));
const probe = createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
const api = await startLocalApi({
  directory,
  port: 0,
  allowedOrigins: [origin],
});
const astro = JSON.parse(
  await readFile("node_modules/astro/package.json", "utf8"),
);
const child = spawn(
  process.execPath,
  [
    join("node_modules/astro", astro.bin.astro),
    "dev",
    "--ignore-lock",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      PUBLIC_API_URL: api.url + "/api",
      SITE_URL: origin,
      BASE_PATH: "/",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (c) => (logs += c));
child.stderr.on("data", (c) => (logs += c));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error(logs);
  await mkdir("artifacts", { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args:
      process.env.OUTDESIGN_TEST_SOFTWARE_GPU === "true"
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
    channel: process.platform === "win32" ? "msedge" : undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("console", (m) => {
    if (m.type() === "error") console.error("Console:", m.text());
  });
  page.on("pageerror", (e) => console.error("Runtime:", e));
  try {
    if (process.env.OUTDESIGN_TEST_AUTHOR_ONLY !== "true") {
      await pageLoadingRegression({ browser, origin });
      await workLabRegression({ page, api, origin });
      await workLabTrackingRegression({ browser, origin });
    } else await page.goto(`${origin}/work/`, { waitUntil: "networkidle" });
    await workLabAuthorRegression({ page, api });
    await siteThemeRegression({ page, origin });
    console.log("Glass cassette regression passed");
  } catch (e) {
    await page.screenshot({
      path: "artifacts/work-lab-failure.png",
      fullPage: true,
    });
    throw e;
  }
} catch (e) {
  console.error(e);
  console.error(logs.slice(-1800));
  process.exitCode = 1;
} finally {
  await browser?.close();
  child.kill();
  await api.close();
  const path = resolve(directory);
  if (
    !path.startsWith(resolve(tmpdir())) ||
    !path.includes("outdesign-work-lab-")
  )
    throw Error("Unsafe test directory");
  await rm(path, { recursive: true, force: true });
}
