import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesLibrary } from "../src/editor/library-search.ts";
test("library search finds actions by category and hint without relying on the active category", () => {
  assert.equal(matchesLibrary("  移動 PX ", "水平移動", "以 px 移動物件", "移動與變形"), true);
  assert.equal(matchesLibrary("流程 旋轉", "旋轉", "以角度旋轉物件", "移動與變形"), false);
  assert.equal(matchesLibrary("", "文字"), true);
});
