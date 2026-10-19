import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentSchema,
  collectAssetIds,
} from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import {
  createCanvasNode,
  descendants,
  selectedForPage,
} from "../src/lib/workspace.ts";
test("workspace accepts nested responsive frames and tracks private image assets", () => {
  const parent = createCanvasNode("home"),
    child = createCanvasNode("home", "image", parent.id),
    asset = crypto.randomUUID();
  child.image = `asset:${asset}`;
  const content = { ...initialContent, workspace: { nodes: [parent, child] } };
  assert.equal(contentSchema.safeParse(content).success, true);
  assert.ok(collectAssetIds(content).includes(asset));
  assert.deepEqual(descendants(content.workspace.nodes, parent.id), [child.id]);
});
test("workspace rejects cycles, missing parents, cross-page nesting and unbounded layout values", () => {
  const a = createCanvasNode("home"),
    b = createCanvasNode("home", "frame", a.id);
  for (const nodes of [
    [{ ...a, parent: b.id }, b],
    [a, { ...b, page: "work" }],
    [a, { ...b, parent: crypto.randomUUID() }],
    [a, { ...a }],
    [{ ...a, columns: 100 }],
    [{ ...a, height: 99999 }],
    [{ ...a, url: "javascript:alert(1)" }],
  ])
    assert.equal(
      contentSchema.safeParse({ ...initialContent, workspace: { nodes } })
        .success,
      false,
    );
});
test("page selection follows the page and removed theme names migrate to Prism", () => {
  assert.equal(selectedForPage(initialContent, "home"), "hero");
  assert.match(selectedForPage(initialContent, "work"), /^project:/);
  assert.match(selectedForPage(initialContent, "journal"), /^note:/);
  assert.equal(selectedForPage(initialContent, "resources"), "attachments");
  for (const theme of ["quiet", "luminous"])
    assert.equal(
      contentSchema.parse({
        ...initialContent,
        settings: { ...initialContent.settings, theme },
      }).settings.theme,
      "prism",
    );
});
