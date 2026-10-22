import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { createHandler } from "../supabase/functions/_shared/handler.ts";
import {
  digest,
  hashPassword,
  SESSION_TTL_MS,
  verifyPassword,
} from "../supabase/functions/_shared/security.ts";
import {
  contentSchema,
  credentialsSchema,
  newCredentialsSchema,
  safeUrl,
} from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import { createLocalStore } from "../server/local-store.ts";

const first = "test-only-first-passphrase-928",
  second = "test-only-second-passphrase-761";
let hashes: [string, string];
before(async () => {
  hashes = (await Promise.all([hashPassword(first), hashPassword(second)])) as [
    string,
    string,
  ];
});
async function fixture(
  t: Parameters<Parameters<typeof test>[1]>[0],
  local = true,
) {
  const directory = await mkdtemp(join(tmpdir(), "outdesign-test-"));
  t.after(async () => {
    const target = resolve(directory);
    assert.ok(
      target.startsWith(resolve(tmpdir()) + sep) &&
        basename(target).startsWith("outdesign-test-"),
    );
    await rm(target, { recursive: true, force: true });
  });
  const store = await createLocalStore(directory);
  let clock = Date.now(),
    pair = hashes;
  const handler = createHandler(store, {
    local,
    allowedOrigins: ["https://outdesign.example"],
    getPasswordHashes: async () => pair,
    now: () => clock,
  });
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
    headers: Record<string, string> = {},
  ) {
    const h: Record<string, string> = {
      Origin: "https://outdesign.example",
      ...headers,
    };
    if (token) h.Authorization = `Bearer ${token}`;
    let data: BodyInit | undefined;
    if (body instanceof FormData) data = body;
    else if (body !== undefined) {
      data = JSON.stringify(body);
      h["Content-Type"] = "application/json";
    }
    return handler(
      new Request(`https://outdesign.example/api${path}`, {
        method,
        headers: h,
        body: data,
      }),
    );
  }
  async function login() {
    const response = await request("/login", "POST", {
      password1: first,
      password2: second,
    });
    assert.equal(response.status, 200);
    return (await response.json()).token as string;
  }
  return {
    store,
    request,
    login,
    directory,
    expire: () => {
      clock += SESSION_TTL_MS + 1;
    },
    rotate: () => {
      pair = [hashes[1], hashes[0]];
    },
  };
}

test("password storage uses salted PBKDF2 and rejects a wrong password", async () => {
  assert.equal(hashes[0].includes(first), false);
  assert.equal(await verifyPassword(first, hashes[0]), true);
  assert.equal(await verifyPassword(second, hashes[0]), false);
  assert.equal(
    await verifyPassword(first, "pbkdf2-sha256:1:invalid:invalid"),
    false,
  );
});
test("malformed or weakened password hash configuration fails closed", async () => {
  const [algorithm, rounds, salt, digest] = hashes[0].split(":");
  for (const encoded of [
    hashes[0] + ":extra",
    `${algorithm}:600000.5:${salt}:${digest}`,
    `${algorithm}:NaN:${salt}:${digest}`,
    `${algorithm}:${rounds}:abc:${digest}`,
    `${algorithm}:${rounds}:${salt}:abc`,
    `${algorithm}:599999:${salt}:${digest}`,
    `${algorithm}:9999999:${salt}:${digest}`,
  ])
    assert.equal(await verifyPassword(first, encoded), false);
});
test("either wrong password denies login; both correct issue a server-side session", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request("/login", "POST", { password1: first, password2: first }))
      .status,
    401,
  );
  assert.equal(
    (
      await f.request("/login", "POST", {
        password1: second,
        password2: second,
      })
    ).status,
    401,
  );
  const token = await f.login();
  assert.equal(
    (await f.request("/draft", "GET", undefined, token)).status,
    200,
  );
  const disk = await readFile(join(f.directory, "state.json"), "utf8");
  assert.equal(disk.includes(token), false);
  assert.equal(disk.includes(await digest(token)), true);
});
test("visitors and forged sessions cannot read drafts, upload, save, publish, or see history", async (t) => {
  const f = await fixture(t);
  for (const [path, method] of [
    ["/draft", "GET"],
    ["/draft", "PATCH"],
    ["/media", "GET"],
    ["/media", "POST"],
    ["/publish", "POST"],
    ["/history", "GET"],
  ] as const)
    assert.equal(
      (await f.request(path, method, method === "GET" ? undefined : {})).status,
      401,
    );
  assert.equal(
    (await f.request("/draft", "GET", undefined, "a".repeat(43))).status,
    401,
  );
  assert.equal((await f.request("/public")).status, 200);
});
test("logout revokes a session and expiration is enforced by the server", async (t) => {
  const f = await fixture(t);
  const token = await f.login();
  assert.equal(
    (await f.request("/logout", "POST", undefined, token)).status,
    200,
  );
  assert.equal(
    (await f.request("/draft", "GET", undefined, token)).status,
    401,
  );
  const token2 = await f.login();
  f.expire();
  assert.equal(
    (await f.request("/draft", "GET", undefined, token2)).status,
    401,
  );
});
test("rotating either password invalidates existing sessions", async (t) => {
  const f = await fixture(t);
  const token = await f.login();
  f.rotate();
  assert.equal(
    (await f.request("/draft", "GET", undefined, token)).status,
    401,
  );
});
test("draft edits remain private and stale revisions cannot overwrite content", async (t) => {
  const f = await fixture(t);
  const token = await f.login();
  const draft = structuredClone(initialContent);
  draft.hero.line1 = "PRIVATE DRAFT";
  assert.equal(
    (await f.request("/draft", "PATCH", { content: draft, revision: 0 }, token))
      .status,
    200,
  );
  assert.equal(
    (
      await f.request(
        "/draft",
        "PATCH",
        { content: initialContent, revision: 0 },
        token,
      )
    ).status,
    409,
  );
  assert.notEqual(
    (await (await f.request("/public")).json()).content.hero.line1,
    "PRIVATE DRAFT",
  );
  const published = await (
    await f.request("/publish", "POST", { revision: 1 }, token)
  ).json();
  assert.equal(published.deployment, "local");
  assert.equal(
    (await (await f.request("/public")).json()).content.hero.line1,
    "PRIVATE DRAFT",
  );
  draft.hero.line1 = "A NEW PRIVATE DRAFT";
  await f.request("/draft", "PATCH", { content: draft, revision: 1 }, token);
  assert.equal(
    (await (await f.request("/public")).json()).content.hero.line1,
    "PRIVATE DRAFT",
  );
  assert.equal(
    (await f.request("/publish", "POST", { revision: 1 }, token)).status,
    409,
  );
});
test("missing production deployment configuration is reported without claiming a live deployment", async (t) => {
  const f = await fixture(t, false),
    token = await f.login();
  const result = await (
    await f.request("/publish", "POST", { revision: 0 }, token)
  ).json();
  assert.equal(result.deployment, "unconfigured");
  assert.ok(result.version);
});
test("upload MIME signatures, private access, range reads, and publication are enforced", async (t) => {
  const f = await fixture(t),
    token = await f.login();
  const fake = new FormData();
  fake.append(
    "file",
    new File(['<svg onload="alert(1)">'], "fake.png", { type: "image/png" }),
  );
  assert.equal((await f.request("/media", "POST", fake, token)).status, 415);
  const form = new FormData();
  form.append(
    "file",
    new File(["private attachment content"], "notes.txt", {
      type: "text/plain",
    }),
  );
  const response = await f.request("/media", "POST", form, token);
  assert.equal(response.status, 201);
  const { media } = await response.json();
  assert.equal((await f.request(`/media/${media.id}`)).status, 401);
  const range = await f.request(`/media/${media.id}`, "GET", undefined, token, {
    Range: "bytes=0-6",
  });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), "private");
  const draft = structuredClone(initialContent);
  draft.attachments.push({
    id: crypto.randomUUID(),
    name: "test",
    url: `asset:${media.id}`,
    label: "TXT",
  });
  await f.request("/draft", "PATCH", { content: draft, revision: 0 }, token);
  assert.equal(
    (await f.request(`/media/${media.id}`, "DELETE", undefined, token)).status,
    409,
  );
  await f.request("/publish", "POST", { revision: 1 }, token);
  const publicFile = await f.request(`/media/${media.id}`);
  assert.equal(publicFile.status, 200);
  assert.match(publicFile.headers.get("Content-Disposition")!, /^attachment/);
  assert.match(publicFile.headers.get("Cache-Control")!, /^public/);
});
test("unknown origins are rejected and login attempts are durably rate limited", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (
      await f.request("/public", "GET", undefined, undefined, {
        Origin: "https://hostile.example",
      })
    ).status,
    403,
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await f.request("/login", "POST", {
          password1: "short",
          password2: "short",
        })
      ).status,
      401,
    );
  const response = await f.request("/login", "POST", {
    password1: first,
    password2: second,
  });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "900");
  const recreated = await createLocalStore(f.directory);
  assert.equal(
    await recreated.consumeLoginBudget(
      await digest(`${hashes[0]}|unknown`),
      Date.now(),
    ),
    false,
  );
});
test("content validation rejects script URLs, unknown fields, excessive blocks, and empty attachment URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>",
    "//hostile.example/a",
    "/assets/../secret",
    "https://user:pass@example.com",
    "http://example.com/a",
  ])
    assert.equal(safeUrl(url), false);
  const doc = structuredClone(initialContent);
  doc.contact.github = "javascript:alert(1)";
  assert.equal(contentSchema.safeParse(doc).success, false);
  assert.equal(
    contentSchema.safeParse({ ...initialContent, admin: true }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      projects: Array(25).fill({id: crypto.randomUUID(), title: "Work", category: "設計", description: "", year: "2026", image: "", alt: "", url: "", tone: "silver", demo: false}),
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      attachments: [{ id: crypto.randomUUID(), name: "x", url: "", label: "" }],
    }).success,
    false,
  );
});

test("layout keeps legacy content valid and accepts each section exactly once", () => {
  assert.equal(contentSchema.safeParse(initialContent).success, true);
  const sections = ["notes", "work", "about", "contact", "attachments"];
  assert.equal(
    contentSchema.safeParse({ ...initialContent, layout: { sections } })
      .success,
    true,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      layout: { sections: ["work", "work", "about", "contact", "attachments"] },
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      layout: { sections: ["work"] },
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      layout: { sections: [...sections.slice(0, 4), "admin"] },
    }).success,
    false,
  );
});

test("new passwords are stronger without rejecting existing login credentials", () => {
  const old = { password1: "older-pass-12", password2: "second-old-12" };
  assert.equal(credentialsSchema.safeParse(old).success, true);
  assert.equal(newCredentialsSchema.safeParse(old).success, false);
  assert.equal(
    newCredentialsSchema.safeParse({ password1: first, password2: first })
      .success,
    false,
  );
  assert.equal(
    newCredentialsSchema.safeParse({ password1: first, password2: second })
      .success,
    true,
  );
});
test("saved assemblies stay private on publication and retain their private media", async (t) => {
  const f = await fixture(t),
    token = await f.login();
  const { createCanvasNode } = await import("../src/lib/workspace.ts");
  const { saveAssembly } = await import("../src/lib/assemblies.ts");
  const frame = createCanvasNode("home", "frame"),
    image = createCanvasNode("home", "image", frame.id),
    id = crypto.randomUUID();
  image.image = `asset:${id}`;
  await f.store.putMedia(
    {
      id,
      name: "private.webp",
      mime: "image/webp",
      size: 12,
      kind: "image",
      path: `${id}.webp`,
      isPublic: false,
      createdAt: new Date().toISOString(),
    },
    new Uint8Array(12),
  );
  const preset = saveAssembly([frame, image], frame.id, "尚未公開的組裝");
  const draft = await f.store.getDraft();
  const content = {
    ...draft.content,
    workspace: { nodes: [], presets: [preset] },
  };
  const saved = await f.request(
    "/draft",
    "PATCH",
    { content, revision: draft.revision },
    token,
  );
  assert.equal(saved.status, 200);
  const revision = (await saved.json()).revision;
  assert.equal(
    (await f.request("/publish", "POST", { revision }, token)).status,
    200,
  );
  const published = await (await f.request("/public")).json();
  assert.equal(published.content.workspace.presets, undefined);
  assert.equal(
    (await f.store.getDraft()).content.workspace?.presets?.length,
    1,
  );
  assert.equal((await f.request(`/media/${id}`)).status, 401);
  assert.equal(
    (await f.request(`/media/${id}`, "DELETE", undefined, token)).status,
    409,
  );
});
