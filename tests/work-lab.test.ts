import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLabItems,
  archiveColumns,
  itemAtCell,
  locateItem,
  ARCHIVE_LAYOUT,
  itemAt,
  normalizePreferences,
  pulse,
  relax,
  revealAt,
  wrap,
} from "../src/lib/work-lab/state.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import { aheadCell } from "../src/lib/work-lab/motion.ts";
test("look-ahead waves follow forward, reverse and diagonal archive navigation", () => {
  const cell = { lane: 3, row: 8 };
  assert.deepEqual(aheadCell(cell, { lane: 0, row: 2 }, 6), { lane: 3, row: 14 });
  assert.deepEqual(aheadCell(cell, { lane: 0, row: -1 }, 6), { lane: 3, row: 2 });
  assert.deepEqual(aheadCell(cell, { lane: 1, row: 0 }, 0), cell);
  assert.deepEqual(aheadCell(cell, { lane: 0, row: 0 }, 6), cell);
  const diagonal = aheadCell(cell, { lane: -2, row: 3 }, 100);
  assert.ok(diagonal.lane < cell.lane && diagonal.row > cell.row);
  assert.ok(Math.abs(Math.hypot((diagonal.lane - cell.lane) * 2.2, diagonal.row - cell.row) - 16) < 1e-9);
});
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

test("archive columns keep independent work rows and wrap without diagonal index collisions", () => {
  const projects = Array.from({ length: 6 }, (_, i) => ({
    id: crypto.randomUUID(),
    title: `Work ${i}`,
    category: i < 4 ? "設計" : "開發",
    year: "2026",
    image: "",
    alt: "",
    description: "",
    url: "",
  }));
  const items = createLabItems(projects);
  assert.equal(archiveColumns(items).length, 2);
  assert.equal(itemAtCell(items, 0, 3).key, projects[3].id);
  assert.equal(itemAtCell(items, 1, 3).key, projects[5].id);
  assert.equal(itemAtCell(items, -1, -1).key, projects[5].id);
  assert.equal(itemAtCell(items, 2, 4).key, projects[0].id);
  assert.deepEqual(locateItem(items, projects[4].id), { lane: 1, row: 0 });
  assert.ok(
    ARCHIVE_LAYOUT.rowGap > ARCHIVE_LAYOUT.cassetteDepth,
    "Upright cassettes never occupy neighboring depth slots",
  );
  assert.ok(ARCHIVE_LAYOUT.columnGap > ARCHIVE_LAYOUT.width);
});

test("projected drag follows both camera tracks and preserves a diagonal release", async () => {
  const { ArchiveDrag, ArchivePlaneMomentum } =
    await import("../src/lib/work-lab/archive-drag.ts");
  const drag = new ArchiveDrag();
  drag.start(0, 0, { lane: { x: -180, y: -80 }, row: { x: 12, y: -16 } }, 0);
  drag.move(-78, -56, 40);
  drag.move(-156, -112, 80);
  assert.ok(Math.abs(drag.value.lane - 1) < 0.00001);
  assert.ok(Math.abs(drag.value.row - 2) < 0.00001);
  const velocity = drag.releaseVelocity(85, false);
  assert.ok(velocity.lane > 0 && velocity.row > velocity.lane);
  const momentum = new ArchivePlaneMomentum({ lane: 1, row: 2 }, velocity);
  momentum.step(0.02);
  assert.ok(momentum.value.lane > 1 && momentum.value.row > 2);
  for (let i = 0; i < 800; i++) momentum.step(0.016);
  assert.equal(momentum.phase, "idle");
  assert.equal(momentum.value.lane, Math.round(momentum.value.lane));
  assert.equal(momentum.value.row, Math.round(momentum.value.row));
});
test("source spring transition is continuous, retains velocity and converges in either direction", async () => {
  const { damp } = await import("../src/lib/work-lab/motion.ts");
  const spring = { value: 0, velocity: 0 };
  damp(spring, 1, 3.7, 0.016);
  assert.ok(spring.value > 0 && spring.value < 0.02);
  for (let i = 0; i < 20; i++) damp(spring, 1, 3.7, 0.016);
  assert.ok(spring.value > 0.2 && spring.value < 0.5);
  const velocity = spring.velocity;
  damp(spring, -1, 3.7, 0.016);
  assert.ok(spring.velocity < velocity);
  for (let i = 0; i < 250; i++) damp(spring, -1, 3.7, 0.016);
  assert.ok(Math.abs(spring.value + 1) < 0.0001);
});
test("full motion can be explicitly selected while per-effect switches remain independent", () => {
  const full = normalizePreferences(
    { motionPreset: "full", effects: { idleWave: false } },
    true,
  );
  assert.equal(full.motion, true);
  assert.equal(full.effects.idleWave, false);
  assert.equal(full.effects.selectionWave, true);
  assert.equal(
    normalizePreferences({ motionPreset: "reduced" }, false).motion,
    false,
  );
});
