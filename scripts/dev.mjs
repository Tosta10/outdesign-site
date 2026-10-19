import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { startLocalApi } from "../server/local-api.mjs";
const api = await startLocalApi();
console.log("Author API ready on http://127.0.0.1:8788 (loopback only).");
const astroPackage = JSON.parse(
  await readFile("node_modules/astro/package.json", "utf8"),
);
const child = spawn(
  process.execPath,
  [
    join("node_modules/astro", astroPackage.bin.astro),
    "dev",
    "--host",
    "127.0.0.1",
    "--port",
    "4321",
  ],
  { stdio: "inherit" },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child.kill();
  await api.close();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => {
  await api.close();
  if (!stopping) process.exit(code || 0);
});
