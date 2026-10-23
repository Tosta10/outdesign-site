import { test } from "node:test";
import assert from "node:assert/strict";
import { filterLayerTree, layerAncestors } from "../src/editor/layer-tree.ts";
import type { LayerItem } from "../src/lib/layers.ts";

const item = (key: string, name: string, parent: string | null = null, patch: Partial<LayerItem> = {}): LayerItem => ({
  key, name, parent, selection: `element:${key}`, hidden: false, locked: false, deleted: false, ...patch,
});
const layers = [item("root", "頁首"), item("group", "主視覺", "root"), item("title", "首頁 TITLE", "group", { hidden: true }), item("other", "圖片", null, { locked: true }), item("gone", "舊連結", "group", { deleted: true })];

test("layer search retains nonmatching ancestors and handles multiple case-insensitive terms", () => {
  const result = filterLayerTree(layers, "  首頁 title ", "all");
  assert.deepEqual([...result.matches], ["title"]);
  assert.deepEqual([...result.visible].sort(), ["group", "root", "title"]);
  assert.equal(result.active, true);
});
test("layer state filters combine with search and retain ancestry", () => {
  assert.deepEqual([...filterLayerTree(layers, "", "hidden").matches], ["title"]);
  assert.deepEqual([...filterLayerTree(layers, "", "locked").visible], ["other"]);
  assert.deepEqual([...filterLayerTree(layers, "", "deleted").matches], ["gone"]);
  assert.equal(filterLayerTree(layers, "圖片", "hidden").visible.size, 0);
});
test("unfiltered tree includes every layer and ancestor paths stay ordered", () => {
  assert.equal(filterLayerTree(layers, " ", "all").visible.size, layers.length);
  assert.equal(filterLayerTree(layers, " ", "all").active, false);
  assert.deepEqual(layerAncestors(layers, "title"), ["root", "group"]);
});
test("missing parents and accidental cycles cannot hang layer filtering", () => {
  const broken = [item("a", "A", "b"), item("b", "B", "a"), item("c", "C", "missing")];
  assert.equal(filterLayerTree(broken, "A", "all").visible.size, 2);
  assert.deepEqual(layerAncestors(broken, "a"), ["b"]);
  assert.deepEqual(layerAncestors(broken, "c"), ["missing"]);
});
