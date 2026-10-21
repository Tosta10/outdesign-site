import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { initialContent } from "../supabase/functions/_shared/seed.ts";

test("production PostgreSQL migration and authorization contracts", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  // Reproduce Supabase-managed roles and the Storage bucket metadata contract.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610190001_studio.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610190002_workspace_media.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610210001_presentation_media.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    "insert into public.studio_state(singleton,draft) values(true,$1::jsonb)",
    [JSON.stringify(initialContent)],
  );
  await t.test(
    "anon and authenticated cannot select private data or invoke privileged procedures",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        try {
          await assert.rejects(
            db.query("select * from public.studio_state"),
            (e: unknown) => (e as { code: string }).code === "42501",
          );
          await assert.rejects(
            db.query("select public.studio_save_draft($1::jsonb,0)", [
              JSON.stringify(initialContent),
            ]),
            (e: unknown) => (e as { code: string }).code === "42501",
          );
          await assert.rejects(
            db.query("select * from public.studio_sessions"),
            (e: unknown) => (e as { code: string }).code === "42501",
          );
        } finally {
          await db.exec("reset role");
        }
      }
      const policies = await db.query<{ count: number }>(
        "select count(*)::int count from pg_tables where schemaname='public' and tablename like 'studio_%' and rowsecurity=true",
      );
      assert.equal(policies.rows[0].count, 5);
    },
  );
  await t.test(
    "draft updates compare revisions and publication stores an immutable snapshot",
    async () => {
      const content = structuredClone(initialContent);
      content.hero.line1 = "database draft";
      const saved = await db.query<{ result: { revision: number } }>(
        "select public.studio_save_draft($1::jsonb,0) result",
        [JSON.stringify(content)],
      );
      assert.equal(saved.rows[0].result.revision, 1);
      const stale = await db.query<{ result: null }>(
        "select public.studio_save_draft($1::jsonb,0) result",
        [JSON.stringify(initialContent)],
      );
      assert.equal(stale.rows[0].result, null);
      const id = crypto.randomUUID();
      const published = await db.query<{ result: { id: string } }>(
        "select public.studio_publish(1,$1::uuid) result",
        [id],
      );
      assert.equal(published.rows[0].result.id, id);
      content.hero.line1 = "next private draft";
      await db.query("select public.studio_save_draft($1::jsonb,1)", [
        JSON.stringify(content),
      ]);
      const snapshot = await db.query<{ title: string }>(
        "select content#>>'{hero,line1}' title from public.studio_versions where id=$1",
        [id],
      );
      assert.equal(snapshot.rows[0].title, "database draft");
    },
  );
  await t.test(
    "publishing makes referenced media public atomically and prevents deleting used media",
    async () => {
      const id = crypto.randomUUID();
      await db.query(
        "insert into public.studio_media(id,name,mime,size,kind,path) values($1,'notes.txt','text/plain',5,'file',$2)",
        [id, `${id}.txt`],
      );
      const content = structuredClone(initialContent);
      content.attachments.push({
        id: crypto.randomUUID(),
        name: "notes",
        url: `asset:${id}`,
        label: "TXT",
      });
      await db.query("select public.studio_save_draft($1::jsonb,2)", [
        JSON.stringify(content),
      ]);
      const denied = await db.query<{ allowed: boolean }>(
        "select public.studio_delete_media($1::uuid) allowed",
        [id],
      );
      assert.equal(denied.rows[0].allowed, false);
      await db.query("select public.studio_publish(3,$1::uuid)", [
        crypto.randomUUID(),
      ]);
      const media = await db.query<{ is_public: boolean }>(
        "select is_public from public.studio_media where id=$1",
        [id],
      );
      assert.equal(media.rows[0].is_public, true);
      await db.query("select public.studio_save_draft($1::jsonb,3)", [
        JSON.stringify(initialContent),
      ]);
      const stillDenied = await db.query<{ allowed: boolean }>(
        "select public.studio_delete_media($1::uuid) allowed",
        [id],
      );
      assert.equal(stillDenied.rows[0].allowed, false);
    },
  );
  await t.test(
    "canvas image references become public in the same publication transaction",
    async () => {
      const id = crypto.randomUUID();
      await db.query(
        "insert into public.studio_media(id,name,mime,size,kind,path) values($1,'canvas.webp','image/webp',100,'image',$2)",
        [id, `${id}.webp`],
      );
      const content = {
        ...initialContent,
        workspace: { nodes: [{ image: `asset:${id}` }] },
      };
      await db.query("select public.studio_save_draft($1::jsonb,4)", [
        JSON.stringify(content),
      ]);
      await db.query("select public.studio_publish(5,$1::uuid)", [
        crypto.randomUUID(),
      ]);
      const media = await db.query<{ is_public: boolean }>(
        "select is_public from public.studio_media where id=$1",
        [id],
      );
      assert.equal(media.rows[0].is_public, true);
    },
  );
  await t.test("custom brand media becomes public atomically", async () => {
    const id = crypto.randomUUID();
    await db.query(
      "insert into public.studio_media(id,name,mime,size,kind,path) values($1,'brand.webp','image/webp',100,'image',$2)",
      [id, `${id}.webp`],
    );
    const content = {
      ...initialContent,
      presentation: { logo: `asset:${id}` },
    };
    await db.query("select public.studio_save_draft($1::jsonb,5)", [
      JSON.stringify(content),
    ]);
    await db.query("select public.studio_publish(6,$1::uuid)", [
      crypto.randomUUID(),
    ]);
    const media = await db.query<{ is_public: boolean }>(
      "select is_public from public.studio_media where id=$1",
      [id],
    );
    assert.equal(media.rows[0].is_public, true);
  });
  await t.test(
    "publication excludes author presets and preserves their private media",
    async () => {
      const id = crypto.randomUUID();
      await db.query(
        "insert into public.studio_media(id,name,mime,size,kind,path) values($1,'private.webp','image/webp',100,'image',$2)",
        [id, `${id}.webp`],
      );
      const content = {
        ...initialContent,
        workspace: {
          nodes: [],
          presets: [
            {
              id: crypto.randomUUID(),
              name: "尚未公開",
              nodes: [{ image: `asset:${id}` }],
            },
          ],
        },
      };
      await db.query("select public.studio_save_draft($1::jsonb,6)", [
        JSON.stringify(content),
      ]);
      const versionId = crypto.randomUUID();
      await db.query("select public.studio_publish(7,$1::uuid)", [versionId]);
      const version = await db.query<{
        content: { workspace: { presets?: unknown } };
      }>("select content from public.studio_versions where id=$1", [versionId]);
      assert.equal(version.rows[0].content.workspace.presets, undefined);
      const media = await db.query<{ is_public: boolean }>(
        "select is_public from public.studio_media where id=$1",
        [id],
      );
      assert.equal(media.rows[0].is_public, false);
      const removed = await db.query<{ removed: boolean }>(
        "select public.studio_delete_media($1::uuid) removed",
        [id],
      );
      assert.equal(removed.rows[0].removed, false);
      const draft = await db.query<{
        draft: { workspace: { presets: unknown[] } };
      }>("select draft from public.studio_state where singleton=true");
      assert.equal(draft.rows[0].draft.workspace.presets.length, 1);
    },
  );
  await t.test(
    "persistent SQL rate limits enforce per-source and global budgets",
    async () => {
      for (let i = 0; i < 10; i++) {
        const r = await db.query<{ allowed: boolean }>(
          "select public.studio_login_budget('one-source') allowed",
        );
        assert.equal(r.rows[0].allowed, true);
      }
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select public.studio_login_budget('one-source') allowed",
          )
        ).rows[0].allowed,
        false,
      );
      for (let i = 11; i < 100; i++)
        await db.query("select public.studio_login_budget($1)", [
          `source-${i}`,
        ]);
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select public.studio_login_budget('another-source') allowed",
          )
        ).rows[0].allowed,
        false,
      );
    },
  );
});
