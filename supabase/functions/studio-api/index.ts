import { createClient } from "@supabase/supabase-js";
import { createHandler } from "../_shared/handler.ts";
import { initialContent } from "../_shared/seed.ts";
import type { Media, StudioStore } from "../_shared/store.ts";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default;
if (!projectUrl || !serviceKey)
  throw new Error("Supabase server credentials are not configured");
const db = createClient(projectUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const required = <T>(result: { data: T; error: unknown }): T => {
  if (result.error) throw new Error("Database operation failed");
  return result.data;
};
const mapMedia = (m: Record<string, unknown>): Media => ({
  id: String(m.id),
  name: String(m.name),
  mime: String(m.mime),
  size: Number(m.size),
  kind: m.kind as Media["kind"],
  path: String(m.path),
  isPublic: Boolean(m.is_public),
  createdAt: String(m.created_at),
});
async function ensureState() {
  required(
    await db
      .from("studio_state")
      .upsert(
        { singleton: true, draft: initialContent },
        { onConflict: "singleton", ignoreDuplicates: true },
      ),
  );
}
const store: StudioStore = {
  async getDraft() {
    await ensureState();
    const row = required(
      await db
        .from("studio_state")
        .select("draft,draft_revision,updated_at")
        .eq("singleton", true)
        .single(),
    );
    if (!row) throw new Error("Studio state is missing");
    return {
      content: row.draft,
      revision: Number(row.draft_revision),
      updatedAt: row.updated_at,
    };
  },
  async saveDraft(content, expectedRevision) {
    return required(
      await db.rpc("studio_save_draft", {
        p_content: content,
        p_expected: expectedRevision,
      }),
    );
  },
  async getPublished() {
    const state = required(
      await db
        .from("studio_state")
        .select("published_version_id")
        .eq("singleton", true)
        .maybeSingle(),
    );
    if (!state?.published_version_id) return null;
    return store.getVersion(state.published_version_id);
  },
  async getVersion(id) {
    const row = required(
      await db.from("studio_versions").select("*").eq("id", id).maybeSingle(),
    );
    return row
      ? { id: row.id, content: row.content, createdAt: row.created_at }
      : null;
  },
  async listVersions() {
    return (
      required(
        await db
          .from("studio_versions")
          .select("id,created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ) || []
    ).map((row) => ({ id: row.id, createdAt: row.created_at }));
  },
  async publish(expectedRevision, id) {
    return required(
      await db.rpc("studio_publish", {
        p_expected: expectedRevision,
        p_id: id,
      }),
    );
  },
  async getSession(hash) {
    const row = required(
      await db
        .from("studio_sessions")
        .select("*")
        .eq("token_hash", hash)
        .maybeSingle(),
    );
    return row
      ? {
          hash: row.token_hash,
          expiresAt: Number(row.expires_at),
          credentialVersion: row.credential_version,
        }
      : null;
  },
  async createSession(session) {
    required(
      await db.from("studio_sessions").delete().lt("expires_at", Date.now()),
    );
    required(
      await db
        .from("studio_sessions")
        .insert({
          token_hash: session.hash,
          expires_at: session.expiresAt,
          credential_version: session.credentialVersion,
        }),
    );
  },
  async deleteSession(hash) {
    required(await db.from("studio_sessions").delete().eq("token_hash", hash));
  },
  async consumeLoginBudget(key) {
    return required(await db.rpc("studio_login_budget", { p_key: key }));
  },
  async listMedia() {
    return (
      required(
        await db
          .from("studio_media")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ) || []
    ).map(mapMedia);
  },
  async getMedia(id) {
    const row = required(
      await db.from("studio_media").select("*").eq("id", id).maybeSingle(),
    );
    return row ? mapMedia(row) : null;
  },
  async putMedia(media, bytes) {
    required(
      await db.storage
        .from("studio-media")
        .upload(media.path, bytes, { contentType: media.mime, upsert: false }),
    );
    const result = await db
      .from("studio_media")
      .insert({
        id: media.id,
        name: media.name,
        mime: media.mime,
        size: media.size,
        kind: media.kind,
        path: media.path,
        is_public: false,
      });
    if (result.error) {
      await db.storage.from("studio-media").remove([media.path]);
      throw new Error("Media metadata failed");
    }
  },
  async readMedia(media, range) {
    const signed = required(
      await db.storage.from("studio-media").createSignedUrl(media.path, 60),
    );
    if (!signed) throw new Error("Could not authorize media stream");
    const headers = new Headers();
    if (range) headers.set("Range", range);
    // Keep the signed URL on the server; stream bytes without buffering large audio.
    const response = await fetch(signed.signedUrl, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    const safeHeaders = new Headers();
    ["content-length", "content-range", "accept-ranges"].forEach((key) => {
      const value = response.headers.get(key);
      if (value) safeHeaders.set(key, value);
    });
    return new Response(response.body, {
      status: response.status,
      headers: safeHeaders,
    });
  },
  async deleteMedia(id) {
    const media = await store.getMedia(id);
    const allowed = required(await db.rpc("studio_delete_media", { p_id: id }));
    if (allowed && media)
      required(await db.storage.from("studio-media").remove([media.path]));
    return allowed;
  },
};
const owner = Deno.env.get("GITHUB_OWNER"),
  repo = Deno.env.get("GITHUB_REPO"),
  token = Deno.env.get("GITHUB_DISPATCH_TOKEN");
const origins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
if (
  !origins.length ||
  origins.some((v) => {
    try {
      return new URL(v).origin !== v || !v.startsWith("https://");
    } catch {
      return true;
    }
  })
)
  throw new Error("Set exact HTTPS ALLOWED_ORIGINS before deploying");
Deno.serve(
  createHandler(store, {
    allowedOrigins: origins,
    getPasswordHashes: async () => {
      const a = Deno.env.get("AUTHOR_PASSWORD_1_HASH"),
        b = Deno.env.get("AUTHOR_PASSWORD_2_HASH");
      return a && b ? [a, b] : null;
    },
    github:
      owner && repo && token
        ? {
            owner,
            repo,
            token,
            workflow: Deno.env.get("GITHUB_WORKFLOW") || "deploy.yml",
          }
        : undefined,
  }),
);
