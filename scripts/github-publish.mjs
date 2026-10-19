import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { secretInput } from "./secret-input.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
if (args.includes("--help")) {
  console.log(
    "pnpm github:publish [--repo outdesign-site] [--private] [--api https://PROJECT.supabase.co/functions/v1/studio-api]\nUses GITHUB_TOKEN/GH_TOKEN or a hidden terminal prompt. Publishes only into an empty repository. Never uploads .env, .local, node_modules, or generated artifacts.",
  );
  process.exit(0);
}
const repo = option("--repo") || "outdesign-site";
if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(repo)) throw new Error("儲存庫名稱不正確");
const token =
  process.env.GITHUB_TOKEN ||
  process.env.GH_TOKEN ||
  (await secretInput("GitHub 存取憑證（不顯示；僅用於本次發布）："));
async function github(path, method = "GET", body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(
      `GitHub ${response.status}: ${data.message || "操作失敗"}`,
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
const user = await github("/user");
const owner = user.login;
const root = `/repos/${owner}/${repo}`;
let repository;
try {
  repository = await github(root);
} catch (e) {
  if (e.status !== 404) throw e;
  repository = await github("/user/repos", "POST", {
    name: repo,
    private: args.includes("--private"),
    description:
      "OutDesign personal website with a secure two-password author studio",
    auto_init: false,
  });
}
let empty = false;
try {
  const branches = await github(`${root}/branches`);
  empty = !branches.length;
} catch (e) {
  if (e.status === 409) empty = true;
  else throw e;
}
if (!empty)
  throw new Error(
    "目標儲存庫已有內容。為保留既有工作，請使用另一個空白儲存庫；後續更新可使用 Git。",
  );
const ignore = new Set([
  "node_modules",
  ".git",
  ".local",
  ".astro",
  "dist",
  "artifacts",
  ".DS_Store",
]);
async function files(directory = ".", relative = "") {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      ignore.has(entry.name) ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example") ||
      entry.name.endsWith(".log") ||
      entry.isSymbolicLink()
    )
      continue;
    const path = join(directory, entry.name),
      name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...(await files(path, name)));
    else if (entry.isFile()) output.push({ name, bytes: await readFile(path) });
  }
  return output;
}
const source = await files();
const tree = [];
for (const file of source) {
  const blob = await github(`${root}/git/blobs`, "POST", {
    content: file.bytes.toString("base64"),
    encoding: "base64",
  });
  tree.push({ path: file.name, mode: "100644", type: "blob", sha: blob.sha });
}
const createdTree = await github(`${root}/git/trees`, "POST", { tree });
const commit = await github(`${root}/git/commits`, "POST", {
  message: "Build OutDesign website and secure author studio",
  tree: createdTree.sha,
  parents: [],
});
await github(`${root}/git/refs`, "POST", {
  ref: "refs/heads/main",
  sha: commit.sha,
});
await github(root, "PATCH", { default_branch: "main" });
const variables = {
  SITE_URL: `https://${owner}.github.io`,
  BASE_PATH: repo === `${owner}.github.io` ? "/" : `/${repo}/`,
};
if (option("--api")) {
  const url = new URL(option("--api"));
  if (url.protocol !== "https:") throw new Error("作者 API 必須使用 HTTPS");
  variables.PUBLIC_API_URL = url.href.replace(/\/$/, "");
}
for (const [name, value] of Object.entries(variables)) {
  try {
    await github(`${root}/actions/variables`, "POST", { name, value });
  } catch {
    console.log(`請於 Repository > Settings > Variables 設定 ${name}=${value}`);
  }
}
let pagesConfigured = false;
try {
  await github(`${root}/pages`, "POST", { build_type: "workflow" });
  pagesConfigured = true;
} catch {
  console.log(
    "原始碼已發布。請於儲存庫 Settings > Pages，將 Source 設為 GitHub Actions。",
  );
}
if (pagesConfigured) {
  try {
    await github(`${root}/actions/workflows/deploy.yml/dispatches`, "POST", {
      ref: "main",
    });
  } catch {
    console.log("請於 Actions 執行 Validate and deploy OutDesign。");
  }
}
console.log(
  `原始碼已發布：${repository.html_url}\n部署紀錄：https://github.com/${owner}/${repo}/actions\n網站將於部署成功後上線：https://${owner}.github.io${variables.BASE_PATH}`,
);
