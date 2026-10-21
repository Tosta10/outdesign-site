import { test } from "node:test";
import assert from "node:assert/strict";
import { contentSchema } from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import {
  createLogicBlock,
  extractLogicBlock,
  findLogicBlock,
} from "../src/lib/logic.ts";
import { createCanvasNode } from "../src/lib/workspace.ts";
import { patchLayer, removeLayer, reorderLayer } from "../src/lib/layers.ts";
test("original layers delete reversibly without mutating source content; locked layers resist deletion", () => {
  const content = structuredClone(initialContent),
    title = content.about.title;
  removeLayer(content, "about", "home");
  assert.equal(content.presentation!.elements!.mission.deleted, true);
  assert.equal(content.about.title, title);
  patchLayer(content, "mission", { deleted: false, locked: true });
  removeLayer(content, "about", "home");
  assert.equal(content.presentation!.elements!.mission.deleted, false);
});
test("custom subtree deletion cleans references and reparenting rejects cycles", () => {
  const c = structuredClone(initialContent),
    a = createCanvasNode("home"),
    b = createCanvasNode("home", "frame", a.id);
  c.workspace = {
    nodes: [a, b],
    scripts: [
      {
        id: crypto.randomUUID(),
        page: "home",
        name: "test",
        target: `node:${b.id}`,
        event: "click",
        key: "Enter",
        x: 0,
        y: 0,
        enabled: true,
        blocks: [],
      },
    ],
  };
  const item = (key: string) => ({
    key: `node-${key}`,
    selection: `node:${key}` as const,
    name: key,
    parent: null,
    locked: false,
    hidden: false,
    deleted: false,
  });
  reorderLayer(c, item(a.id), item(b.id), true);
  assert.equal(a.parent, null);
  removeLayer(c, `node:${a.id}`, "home");
  assert.equal(c.workspace.nodes.length, 0);
  assert.equal(c.workspace.scripts!.length, 0);
});
test("logic grammar accepts branches and rejects unbounded, duplicate or executable operations", () => {
  const c = structuredClone(initialContent),
    repeat = createLogicBlock("repeat"),
    condition = createLogicBlock("if-variable");
  condition.children.push(createLogicBlock("text"));
  condition.otherwise.push(createLogicBlock("opacity"));
  repeat.children.push(condition);
  c.workspace = {
    nodes: [],
    scripts: [
      {
        id: crypto.randomUUID(),
        page: "home",
        name: "條件",
        target: "hero",
        event: "click",
        key: "Enter",
        x: 30,
        y: 40,
        enabled: true,
        blocks: [repeat],
      },
    ],
  };
  assert.ok(contentSchema.safeParse(c).success);
  const original = JSON.stringify(c);
  const text = findLogicBlock(repeat.children, condition.children[0].id)!;
  assert.equal(
    extractLogicBlock(c.workspace.scripts![0].blocks, text.id)?.op,
    "text",
  );
  for (const bad of ["javascript:alert(1)", "https://user:pass@example.com"]) {
    const test = JSON.parse(original),
      link = createLogicBlock("link");
    link.value = bad;
    test.workspace.scripts[0].blocks = [link];
    assert.equal(contentSchema.safeParse(test).success, false);
  }
  const duplicates = JSON.parse(original);
  duplicates.workspace.scripts[0].blocks.push(
    duplicates.workspace.scripts[0].blocks[0],
  );
  assert.equal(contentSchema.safeParse(duplicates).success, false);
  const deep = JSON.parse(original);
  let head = createLogicBlock("repeat"),
    root = head;
  for (let n = 0; n < 6; n++) {
    const child = createLogicBlock("repeat");
    head.children.push(child);
    head = child;
  }
  deep.workspace.scripts[0].blocks = [root];
  assert.equal(contentSchema.safeParse(deep).success, false);
  const injection = JSON.parse(original);
  injection.workspace.scripts[0].blocks[0].op = "eval";
  assert.equal(contentSchema.safeParse(injection).success, false);
});
