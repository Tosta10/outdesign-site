import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSchema } from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import { resolveWorkLabConfig, labParameters } from "../supabase/functions/_shared/work-lab-config.ts";
import { patchLabConfig } from "../src/lib/work-lab/bridge.ts";
import { createLogicBlock, logicCatalog } from "../src/lib/logic.ts";
import { ArchiveMomentum } from "../src/lib/work-lab/archive-drag.ts";

test("author configuration round-trips through the publish schema while legacy drafts stay valid", () => {
  assert.ok(contentSchema.safeParse(initialContent).success);
  const workLab = resolveWorkLabConfig();
  workLab.parameters.cameraFollow = 32;
  workLab.parameters.coverScale = .58;
  workLab.palette.shell = "#c8d8cd";
  workLab.effects.idleWave = false;
  const content = contentSchema.parse({ ...initialContent, workLab });
  assert.deepEqual(JSON.parse(JSON.stringify(content)).workLab, workLab);
  const legacy = structuredClone(workLab) as any;
  delete legacy.parameters.selectionDelay;
  delete legacy.palette.top;
  delete legacy.palette.darkTop;
  const migrated = contentSchema.parse({ ...initialContent, workLab: legacy }).workLab!;
  assert.equal(migrated.parameters.selectionDelay, .45);
  assert.equal(migrated.palette.top, "#969894");
  for (const invalid of [Infinity, NaN, 200, -1]) {
    assert.equal(contentSchema.safeParse({ ...content, workLab: { ...workLab, parameters: { ...workLab.parameters, cameraFollow: invalid } } }).success, false);
  }
  assert.equal(contentSchema.safeParse({ ...content, workLab: { ...workLab, palette: { ...workLab.palette, shell: "url(javascript:alert(1))" } } }).success, false);
  assert.equal(contentSchema.safeParse({ ...content, workLab: { ...workLab, execute: "arbitrary code" } }).success, false);
});

test("block bridge bounds parameters and rejects unknown options and colors", () => {
  let config = resolveWorkLabConfig();
  config = patchLabConfig(config, { type: "parameter", key: "coverScale", value: 90 });
  assert.equal(config.parameters.coverScale, labParameters.coverScale.max);
  assert.ok(config.parameters.coverScale < 1, "The cassette always retains an outer border");
  config = patchLabConfig(config, { type: "parameter", key: "cameraFollow", value: NaN });
  assert.equal(config.parameters.cameraFollow, labParameters.cameraFollow.value);
  assert.equal(patchLabConfig(config, { type: "parameter", key: "__proto__", value: 1 }), config);
  config = patchLabConfig(config, { type: "option", key: "theme", value: "script" });
  assert.equal(config.options.theme, "light");
  config = patchLabConfig(config, { type: "palette", key: "shell", value: "red;display:none" });
  assert.equal(config.palette.shell, "#e1dcd1");
  config = patchLabConfig(config, { type: "effect", key: "idleWave", value: false });
  assert.equal(config.effects.idleWave, false);
  assert.equal(config.effects.selectionWave, true);
});

test("every cassette operation is available as a bounded persisted block", () => {
  const blocks = logicCatalog.filter(b => b.category === "work-lab").map(b => createLogicBlock(b.op));
  assert.equal(blocks.length, 5);
  const content = structuredClone(initialContent);
  content.workspace = { nodes: [], scripts: [{ id: crypto.randomUUID(), page: "work", target: "projects", name: "卡帶控制", event: "load", key: "", x: 0, y: 0, enabled: true, blocks }] };
  assert.ok(contentSchema.safeParse(content).success);
});

test("author inertia affects coast distance and configured snap still converges", () => {
  const loose = new ArchiveMomentum(0, 5, .8, 10), tight = new ArchiveMomentum(0, 5, 8, 20);
  for (let i = 0; i < 50; i++) { loose.step(.016); tight.step(.016); }
  assert.ok(loose.value > tight.value + 1);
  for (let i = 0; i < 1200; i++) { loose.step(.016); tight.step(.016); }
  assert.equal(loose.phase, "idle");
  assert.equal(tight.phase, "idle");
});
