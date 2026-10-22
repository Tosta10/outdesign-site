import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLabItems,
  itemAt,
  normalizePreferences,
  pulse,
  relax,
  revealAt,
  wrap,
} from "../src/lib/work-lab/state.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
test("portfolio starts empty and the glass cassette placeholder is not a fabricated work", () => {
  assert.deepEqual(initialContent.projects, []);
  const items = createLabItems([]);
  assert.equal(items[0].empty, true);
  assert.equal(items[0].image, "");
  assert.equal(items[0].code, "NO.001");
});
test("actual work fields, image URL and stable identity drive the cassette", () => {
  const projects = [
    {
      id: crypto.randomUUID(),
      title: "Own work",
      category: "設計",
      year: "2026",
      image: "/assets/own.png",
      alt: "own",
      description: "Own description",
      url: "https://example.com/",
    },
    {
      id: crypto.randomUUID(),
      title: "Next work",
      category: "開發",
      year: "2026",
      image: "",
      alt: "",
      description: "",
      url: "",
    },
  ];
  const items = createLabItems(projects);
  assert.equal(items[0].image, projects[0].image);
  assert.equal(items[0].key, projects[0].id);
  assert.equal(items[0].description, projects[0].description);
  assert.equal(items[1].code, "NO.002");
  assert.equal(itemAt(items, -1).title, "Next work");
  assert.equal(itemAt(items, 2).title, "Own work");
});
test("motion envelopes remain bounded and preferences honor system motion settings", () => {
  for (let i = -5; i <= 5; i++) {
    assert.ok(wrap(i, 3) >= 0 && wrap(i, 3) < 3);
  }
  assert.equal(pulse(2, 4), 0);
  assert.equal(revealAt(0, 0.5), 0);
  assert.equal(revealAt(1, 0.5), 1);
  assert.equal(relax(1, 2, 0), 1);
  assert.equal(
    normalizePreferences({ quality: "high", motion: true, volume: 5 }, true)
      .motion,
    false,
  );
  assert.equal(normalizePreferences({ volume: 5 }).volume, 0.3);
  assert.equal(normalizePreferences({ quality: "invalid" }).quality, "medium");
});
