import test from "node:test";
import assert from "node:assert/strict";
import { blockRecipes, createBlockRecipe } from "../src/lib/blocks.ts";
import {
  contentSchema,
  collectAssetIds,
} from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import { saveAssembly, instantiateAssembly } from "../src/lib/assemblies.ts";
test("every block recipe creates a valid atomic tree and unique reusable IDs", () => {
  for (const recipe of blockRecipes) {
    const first = createBlockRecipe(recipe.id, "home"),
      second = createBlockRecipe(recipe.id, "home");
    assert.equal(
      new Set([...first, ...second].map((n) => n.id)).size,
      first.length + second.length,
    );
    assert.ok(
      contentSchema.safeParse({
        ...initialContent,
        workspace: { nodes: [...first, ...second] },
      }).success,
    );
    assert.ok(first.slice(1).every((n) => n.parent === first[0].id));
  }
});
test("named assemblies preserve structure and styles with independent IDs on reuse", () => {
  const nodes = createBlockRecipe("split", "about");
  nodes[0].appearance = {
    background: "#182022",
    borderColor: "#abbaac",
    borderWidth: 2,
    effect: "outline",
  };
  const preset = saveAssembly(nodes, nodes[0].id, "資訊組合");
  const first = instantiateAssembly(preset, "home", null),
    second = instantiateAssembly(preset, "home", null);
  assert.equal(
    new Set([...first, ...second].map((n) => n.id)).size,
    first.length + second.length,
  );
  assert.deepEqual(first[0].appearance, nodes[0].appearance);
  assert.ok(first.slice(1).every((n) => n.parent === first[0].id));
  first[1].body = "changed independently";
  assert.notEqual(second[1].body, first[1].body);
  assert.notEqual(preset.nodes[1].body, first[1].body);
  assert.ok(
    contentSchema.safeParse({
      ...initialContent,
      workspace: { nodes: [...first, ...second], presets: [preset] },
    }).success,
  );
  assert.equal(
    contentSchema.safeParse({
      ...initialContent,
      workspace: {
        nodes: [],
        presets: [preset, { ...preset, id: crypto.randomUUID() }],
      },
    }).success,
    false,
  );
});
test("unused assembly media remain private, but are retained as draft references", () => {
  const nodes = createBlockRecipe("split", "home"),
    id = crypto.randomUUID();
  nodes[1].image = `asset:${id}`;
  const preset = saveAssembly(nodes, nodes[0].id, "私有圖文");
  const content = {
    ...initialContent,
    workspace: { nodes: [], presets: [preset] },
  };
  assert.equal(collectAssetIds(content).includes(id), false);
  assert.equal(collectAssetIds(content, true).includes(id), true);
  content.workspace.nodes = instantiateAssembly(
    preset,
    "home",
    null,
  ) as never[];
  assert.equal(collectAssetIds(content).includes(id), true);
});
test("panel appearance is bounded and rejects injected CSS", () => {
  const nodes = createBlockRecipe("panel", "home");
  for (const appearance of [
    { background: "url(https://evil.example)" },
    { borderWidth: 100 },
    { effect: "script" },
    { shadow: "0 0 2px red" },
  ]) {
    assert.equal(
      contentSchema.safeParse({
        ...initialContent,
        workspace: { nodes: [{ ...nodes[0], appearance }] },
      }).success,
      false,
    );
  }
});
test("presentation supports safe brand assets and rejects executable or oversized data", () => {
  const id = crypto.randomUUID();
  const content = {
    ...initialContent,
    presentation: { logo: `asset:${id}`, copy: { "menu.label": "導覽" } },
  };
  assert.ok(contentSchema.safeParse(content).success);
  assert.ok(collectAssetIds(content).includes(id));
  assert.equal(
    contentSchema.safeParse({
      ...content,
      presentation: { logo: "javascript:alert(1)" },
    }).success,
    false,
  );
  assert.equal(
    contentSchema.safeParse({
      ...content,
      presentation: { copy: { "invalid/key": "text" } },
    }).success,
    false,
  );
});
