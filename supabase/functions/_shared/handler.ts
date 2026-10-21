import { z } from "zod";
import {
  assetId,
  collectAssetIds,
  contentSchema,
  credentialsSchema,
  newCredentialsSchema,
  uploadTypes,
} from "./schema.ts";
import { initialContent } from "./seed.ts";
import {
  digest,
  hashPassword,
  matchesFileSignature,
  newToken,
  SESSION_TTL_MS,
  verifyPassword,
} from "./security.ts";
import type { StudioStore } from "./store.ts";

export type ApiConfig = {
  allowedOrigins: string[];
  getPasswordHashes: () => Promise<[string, string] | null>;
  bootstrap?: (hashes: [string, string]) => Promise<void>;
  local?: boolean;
  now?: () => number;
  github?: { owner: string; repo: string; token: string; workflow: string };
};
class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const saveSchema = z
  .object({ content: contentSchema, revision: z.number().int().nonnegative() })
  .strict();
const revisionSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
async function boundedBody(request: Request, max: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > max)
    throw new ApiError(413, "檔案或資料超過大小限制");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "檔案或資料超過大小限制");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function jsonBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError(415, "請使用 JSON 資料");
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 256_000)),
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "JSON 格式不正確");
  }
}

export function createHandler(store: StudioStore, config: ApiConfig) {
  const now = config.now || Date.now;
  return async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get("origin");
    const cors = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
    });
    const respond = (value: unknown, status = 200) =>
      Response.json(value, { status, headers: cors });
    if (origin && !config.allowedOrigins.includes(origin))
      return respond({ error: "此來源未獲授權" }, 403);
    if (origin) cors.set("Access-Control-Allow-Origin", origin);
    cors.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    cors.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, Range",
    );
    cors.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(request.url);
      // Both /api (local) and /functions/v1/studio-api (Supabase) use the same router.
      const segments = url.pathname.split("/").filter(Boolean);
      const marker = segments.indexOf("studio-api");
      const route =
        "/" +
        (marker >= 0
          ? segments.slice(marker + 1)
          : segments[0] === "api"
            ? segments.slice(1)
            : segments
        ).join("/");
      const hashes = await config.getPasswordHashes();
      if (route === "/status" && request.method === "GET")
        return respond({
          configured: Boolean(hashes),
          setupAvailable: Boolean(config.local && config.bootstrap && !hashes),
        });
      if (route === "/public" && request.method === "GET") {
        const published = await store.getPublished();
        return respond({
          content: published?.content || initialContent,
          version: published?.id || "initial",
          publishedAt: published?.createdAt || null,
        });
      }
      if (route === "/setup" && request.method === "POST") {
        if (!config.local || !config.bootstrap || hashes)
          throw new ApiError(404, "找不到此功能");
        const credentials = newCredentialsSchema.parse(await jsonBody(request));
        if (credentials.password1 === credentials.password2)
          throw new ApiError(400, "請使用兩組不同的密碼");
        const pair = (await Promise.all([
          hashPassword(credentials.password1),
          hashPassword(credentials.password2),
        ])) as [string, string];
        await config.bootstrap(pair);
        return respond({ configured: true });
      }
      if (route === "/login" && request.method === "POST") {
        if (!hashes) throw new ApiError(503, "作者服務尚未設定");
        const ip =
          request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
          "unknown";
        const ipKey = await digest(`${hashes[0]}|${ip}`);
        if (!(await store.consumeLoginBudget(ipKey, now()))) {
          cors.set("Retry-After", "900");
          throw new ApiError(429, "登入嘗試過多，請 15 分鐘後再試");
        }
        const parsed = credentialsSchema.safeParse(await jsonBody(request));
        if (!parsed.success)
          throw new ApiError(401, "兩組密碼不正確，請重新輸入");
        const valid = await Promise.all([
          verifyPassword(parsed.data.password1, hashes[0]),
          verifyPassword(parsed.data.password2, hashes[1]),
        ]);
        if (!valid.every(Boolean))
          throw new ApiError(401, "兩組密碼不正確，請重新輸入");
        const token = newToken(),
          expiresAt = now() + SESSION_TTL_MS;
        await store.createSession({
          hash: await digest(token),
          expiresAt,
          credentialVersion: await digest(hashes.join("|")),
        });
        return respond({ token, expiresAt });
      }
      async function authorize() {
        const token = request.headers
          .get("authorization")
          ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
        if (!token || !hashes)
          throw new ApiError(401, "請重新輸入兩組密碼登入");
        const hash = await digest(token),
          session = await store.getSession(hash);
        if (
          !session ||
          session.expiresAt <= now() ||
          session.credentialVersion !== (await digest(hashes.join("|")))
        )
          throw new ApiError(401, "作者工作階段已到期，請重新登入");
        return hash;
      }
      if (route.startsWith("/media/") && request.method === "GET") {
        const id = assetId.parse(route.slice(7)),
          media = await store.getMedia(id);
        if (!media) throw new ApiError(404, "找不到素材");
        if (!media.isPublic) await authorize();
        const response = await store.readMedia(
          media,
          request.headers.get("range"),
        );
        if (!response.ok && response.status !== 416)
          throw new ApiError(502, "素材暫時無法讀取，請稍後重試");
        const headers = new Headers(response.headers);
        cors.forEach((value, key) => headers.set(key, value));
        headers.set("Content-Type", media.mime);
        headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
        headers.set(
          "Cache-Control",
          media.isPublic
            ? "public, max-age=31536000, immutable"
            : "private, no-store",
        );
        headers.set(
          "Content-Disposition",
          `${media.kind === "file" ? "attachment" : "inline"}; filename="download.${uploadTypes[media.mime].extension}"; filename*=UTF-8''${encodeURIComponent(media.name)}`,
        );
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      }
      const sessionHash = await authorize();
      if (route === "/logout" && request.method === "POST") {
        await store.deleteSession(sessionHash);
        return respond({ ok: true });
      }
      if (route === "/draft" && request.method === "GET")
        return respond(await store.getDraft());
      if (route === "/draft" && request.method === "PATCH") {
        const { content, revision } = saveSchema.parse(await jsonBody(request));
        const saved = await store.saveDraft(content, revision);
        if (!saved)
          throw new ApiError(409, "草稿已被其他分頁修改，請重新載入後再編輯");
        return respond(saved);
      }
      if (route === "/history" && request.method === "GET")
        return respond({ versions: await store.listVersions() });
      if (route.startsWith("/history/") && request.method === "GET") {
        const version = await store.getVersion(assetId.parse(route.slice(9)));
        if (!version) throw new ApiError(404, "找不到此版本");
        return respond(version);
      }
      if (route === "/media" && request.method === "GET")
        return respond({ media: await store.listMedia() });
      if (route === "/media" && request.method === "POST") {
        const mimeHeader = request.headers.get("content-type") || "";
        if (!mimeHeader.startsWith("multipart/form-data"))
          throw new ApiError(415, "請使用檔案上傳格式");
        const bytes = await boundedBody(request, 26_000_000);
        const form = await new Response(new Uint8Array(bytes).buffer, {
          headers: { "content-type": mimeHeader },
        }).formData();
        const file = form.get("file");
        if (!(file instanceof File)) throw new ApiError(400, "請選擇一個檔案");
        const type = uploadTypes[file.type];
        if (!type)
          throw new ApiError(
            415,
            "支援 JPG、PNG、WebP、AVIF、GIF、MP3、WAV、OGG、M4A、PDF、ZIP 與 TXT",
          );
        if (!file.size || file.size > type.limit)
          throw new ApiError(413, "檔案超過此格式的大小限制");
        const data = new Uint8Array(await file.arrayBuffer());
        if (!matchesFileSignature(data, file.type))
          throw new ApiError(415, "檔案內容與格式不符");
        const id = crypto.randomUUID();
        const media = {
          id,
          name:
            file.name.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 150) ||
            `file.${type.extension}`,
          mime: file.type,
          size: file.size,
          kind: type.kind,
          path: `${id}.${type.extension}`,
          isPublic: false,
          createdAt: new Date(now()).toISOString(),
        };
        await store.putMedia(media, data);
        return respond({ media }, 201);
      }
      if (route.startsWith("/media/") && request.method === "DELETE") {
        if (!(await store.deleteMedia(assetId.parse(route.slice(7)))))
          throw new ApiError(409, "此素材正被草稿或發布版本使用，無法刪除");
        return respond({ ok: true });
      }
      async function dispatch(version: string) {
        if (config.local)
          return {
            deployment: "local",
            message: "已發布至本機預覽，關閉編輯器後可查看。",
          };
        if (!config.github)
          return {
            deployment: "unconfigured",
            message: "發布版本已儲存；請完成 GitHub 自動部署設定後重試部署。",
          };
        const { owner, repo, workflow, token } = config.github;
        try {
          const response = await fetch(
            `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "Content-Type": "application/json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
              body: JSON.stringify({
                ref: "main",
                inputs: { content_version: version },
              }),
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (!response.ok)
            return {
              deployment: "failed",
              message:
                "版本已儲存，但建置啟動失敗。請檢查 GitHub 設定後重試部署。",
            };
          const result = response.status === 204 ? {} : await response.json();
          return {
            deployment: "queued",
            message:
              "版本已儲存，GitHub 正在排程建置；完成後才會更新公開網站。",
            runId: result.workflow_run_id || null,
            runUrl:
              result.html_url || `https://github.com/${owner}/${repo}/actions`,
          };
        } catch {
          return {
            deployment: "failed",
            message: "版本已儲存，但連線 GitHub 失敗；可以重試部署。",
          };
        }
      }
      if (route === "/publish" && request.method === "POST") {
        const { revision } = revisionSchema.parse(await jsonBody(request));
        const draft = await store.getDraft();
        contentSchema.parse(draft.content);
        for (const id of collectAssetIds(draft.content)) {
          if (!(await store.getMedia(id)))
            throw new ApiError(400, "內容引用的素材不存在，請重新選擇素材");
        }
        const version = await store.publish(revision, crypto.randomUUID());
        if (!version)
          throw new ApiError(409, "草稿版本已更新，請儲存最新內容後再發布");
        return respond({
          version: version.id,
          ...(await dispatch(version.id)),
        });
      }
      if (route === "/deploy" && request.method === "POST") {
        const { version } = z
          .object({ version: assetId })
          .strict()
          .parse(await jsonBody(request));
        const current = await store.getPublished();
        if (current?.id !== version)
          throw new ApiError(409, "請部署最新發布版本");
        return respond({ version, ...(await dispatch(version)) });
      }
      if (route === "/deployment" && request.method === "GET") {
        const run = url.searchParams.get("run");
        if (!config.github || !run || !/^\d{1,20}$/.test(run))
          throw new ApiError(400, "缺少有效的建置編號");
        const g = config.github;
        const response = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(g.owner)}/${encodeURIComponent(g.repo)}/actions/runs/${run}`,
          {
            headers: {
              Authorization: `Bearer ${g.token}`,
              Accept: "application/vnd.github+json",
            },
            signal: AbortSignal.timeout(10_000),
          },
        );
        if (!response.ok) throw new ApiError(502, "暫時無法讀取建置狀態");
        const data = await response.json();
        return respond({
          status: data.status,
          conclusion: data.conclusion,
          url: data.html_url,
        });
      }
      throw new ApiError(404, "找不到此功能");
    } catch (error) {
      if (error instanceof ApiError)
        return respond({ error: error.message }, error.status);
      if (error instanceof z.ZodError)
        return respond(
          {
            error: "內容格式不正確",
            details: error.issues
              .slice(0, 4)
              .map((i) => `${i.path.join(".")}: ${i.message}`),
          },
          400,
        );
      return respond({ error: "服務暫時無法完成操作，請稍後再試" }, 500);
    }
  };
}
