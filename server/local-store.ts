import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  collectAssetIds,
  contentSchema,
} from "../supabase/functions/_shared/schema.ts";
import type { SiteContent } from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import type {
  Draft,
  Media,
  Session,
  StudioStore,
  Version,
} from "../supabase/functions/_shared/store.ts";

type State = {
  draft: Draft;
  published: string | null;
  versions: Version[];
  sessions: Session[];
  media: Media[];
  buckets: Record<string, { window: number; count: number }>;
};
export async function createLocalStore(
  directory: string,
): Promise<StudioStore> {
  await mkdir(join(directory, "media"), { recursive: true });
  const path = join(directory, "state.json");
  let state: State;
  try {
    state = JSON.parse(await readFile(path, "utf8"));
    contentSchema.parse(state.draft.content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    state = {
      draft: {
        content: structuredClone(initialContent),
        revision: 0,
        updatedAt: new Date().toISOString(),
      },
      published: null,
      versions: [],
      sessions: [],
      media: [],
      buckets: {},
    };
  }
  let queue: Promise<unknown> = Promise.resolve();
  function transaction<T>(
    operation: (next: State) => T | Promise<T>,
  ): Promise<T> {
    const next = queue.then(async () => {
      const draft = structuredClone(state);
      const result = await operation(draft);
      await writeFile(`${path}.pending`, JSON.stringify(draft), {
        mode: 0o600,
      });
      await rename(`${path}.pending`, path);
      state = draft;
      return structuredClone(result);
    });
    queue = next.catch(() => undefined);
    return next;
  }
  const get = async <T>(operation: (s: State) => T) => {
    await queue;
    return structuredClone(operation(state));
  };
  return {
    getDraft: () => get((s) => s.draft),
    saveDraft: (content, expected) =>
      transaction((s) => {
        if (s.draft.revision !== expected) return null;
        s.draft = {
          content,
          revision: expected + 1,
          updatedAt: new Date().toISOString(),
        };
        return s.draft;
      }),
    getPublished: () =>
      get((s) => s.versions.find((v) => v.id === s.published) || null),
    getVersion: (id) => get((s) => s.versions.find((v) => v.id === id) || null),
    listVersions: () =>
      get((s) =>
        s.versions
          .slice()
          .reverse()
          .slice(0, 50)
          .map(({ id, createdAt }) => ({ id, createdAt })),
      ),
    publish: (expected, id) =>
      transaction((s) => {
        if (s.draft.revision !== expected) return null;
        const version = {
          id,
          content: s.draft.content,
          createdAt: new Date().toISOString(),
        };
        s.versions.push(version);
        s.published = id;
        const ids = collectAssetIds(version.content);
        s.media.forEach((m) => {
          if (ids.includes(m.id)) m.isPublic = true;
        });
        return version;
      }),
    getSession: (hash) =>
      get((s) => s.sessions.find((session) => session.hash === hash) || null),
    createSession: (session) =>
      transaction((s) => {
        s.sessions = s.sessions.filter((v) => v.expiresAt > Date.now());
        s.sessions.push(session);
      }),
    deleteSession: (hash) =>
      transaction((s) => {
        s.sessions = s.sessions.filter((v) => v.hash !== hash);
      }),
    consumeLoginBudget: (ip, now) =>
      transaction((s) => {
        const window = Math.floor(now / 900_000);
        Object.keys(s.buckets).forEach((key) => {
          if (s.buckets[key].window !== window) delete s.buckets[key];
        });
        let allowed = true;
        for (const [key, limit] of [
          [`ip:${ip}`, 10],
          ["global", 100],
        ] as const) {
          const bucket = s.buckets[key] || { window, count: 0 };
          bucket.count++;
          s.buckets[key] = bucket;
          if (bucket.count > limit) allowed = false;
        }
        return allowed;
      }),
    listMedia: () => get((s) => [...s.media].reverse()),
    getMedia: (id) => get((s) => s.media.find((m) => m.id === id) || null),
    putMedia: (media, bytes) =>
      transaction(async (s) => {
        await writeFile(join(directory, "media", media.path), bytes, {
          flag: "wx",
          mode: 0o600,
        });
        s.media.push(media);
      }),
    readMedia: async (media, range) => {
      const data = new Uint8Array(
        await readFile(join(directory, "media", media.path)),
      );
      const headers = new Headers({
        "Accept-Ranges": "bytes",
        "Content-Length": String(data.length),
      });
      if (!range) return new Response(data, { headers });
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        headers.set("Content-Range", `bytes */${data.length}`);
        headers.delete("Content-Length");
        return new Response(null, { status: 416, headers });
      }
      const start = match[1]
        ? Number(match[1])
        : Math.max(0, data.length - Number(match[2]));
      const end =
        match[1] && match[2]
          ? Math.min(Number(match[2]), data.length - 1)
          : data.length - 1;
      if (start >= data.length || start > end) {
        headers.set("Content-Range", `bytes */${data.length}`);
        headers.delete("Content-Length");
        return new Response(null, { status: 416, headers });
      }
      headers.set("Content-Range", `bytes ${start}-${end}/${data.length}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(data.slice(start, end + 1), { status: 206, headers });
    },
    deleteMedia: (id) =>
      transaction(async (s) => {
        const media = s.media.find((m) => m.id === id);
        if (!media) return true;
        if (media.isPublic || collectAssetIds(s.draft.content).includes(id))
          return false;
        await unlink(join(directory, "media", media.path));
        s.media = s.media.filter((m) => m.id !== id);
        return true;
      }),
  };
}
