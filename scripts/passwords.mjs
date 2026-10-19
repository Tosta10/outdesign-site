import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashPassword } from "../supabase/functions/_shared/security.ts";
import { credentialsSchema } from "../supabase/functions/_shared/schema.ts";
import { secretInput } from "./secret-input.mjs";
let hashes;
if (process.argv.includes("--from-local")) {
  hashes = JSON.parse(
    await readFile(".local/secrets.json", "utf8"),
  ).passwordHashes;
} else {
  const password1 = await secretInput(
    "第一組作者密碼（不顯示，至少 12 字元）：",
  );
  const password2 = await secretInput(
    "第二組作者密碼（不顯示，至少 12 字元）：",
  );
  credentialsSchema.parse({ password1, password2 });
  if (password1 === password2) throw new Error("請使用兩組不同的密碼");
  hashes = await Promise.all([
    hashPassword(password1),
    hashPassword(password2),
  ]);
}
await mkdir(".local", { recursive: true });
const file = resolve(".local/production-secrets.env");
await writeFile(
  file,
  `AUTHOR_PASSWORD_1_HASH=${hashes[0]}\nAUTHOR_PASSWORD_2_HASH=${hashes[1]}\n`,
  { mode: 0o600, flag: process.argv.includes("--rotate") ? "w" : "wx" },
);
console.log(
  `已儲存兩組密碼雜湊：${file}\n此檔案已排除 Git。請將它設定為 Supabase Edge Function Secrets。`,
);
