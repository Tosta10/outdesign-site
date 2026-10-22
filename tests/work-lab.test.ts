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
import { aheadCell, dampMoving, followNavigation, damp } from "../src/lib/work-lab/motion.ts";

test("renderer navigation preserves velocity between repeats at 30/60/120 Hz and bounds slow-frame prediction", () => {
  for (const hz of [30, 60, 120]) {
    const spring = { value: 0, velocity: 0 };
    const samples: number[] = [];
    let maxError = 0;
    for (let frame = 1; frame <= hz * 3; frame++) {
      const time = frame / hz;
      const target = Math.floor(time * 30 + 1e-7);
      followNavigation(spring, target, 30, 30, time - target / 30, 24, 1 / hz);
      if (time > .3) {
        samples.push(spring.velocity);
        maxError = Math.max(maxError, Math.abs(spring.value - target));
      }
    }
    assert.ok(samples.every(speed => speed > .5), `${hz} Hz must not zero velocity between repeats`);
    assert.ok(maxError < 1.25);
    const before = spring.value;
    damp(spring, 90, 24, 1 / hz);
    assert.ok(Math.abs(spring.value - before) < 1.25, "Release keeps position continuous");
    for (let frame = 0; frame < hz * 2; frame++) damp(spring, 90, 24, 1 / hz);
    assert.ok(Math.abs(spring.value - 90) < .001 && Math.abs(spring.velocity) < .001);
  }
  for (const dt of [.1, .25, .5, 1]) {
    const spring = { value: 0, velocity: 30 };
    followNavigation(spring, 30, 60, 60, dt, 24, dt);
    assert.ok(Number.isFinite(spring.velocity));
    assert.ok(spring.value <= 30.85, "A late frame cannot extrapolate past the prediction budget");
  }
});
test("moving-track spring retains velocity while following a held key and braking", () => {
  const state = { value: 0, velocity: 0 };
  const dt = 1 / 60, speed = 30;
  const speeds: number[] = [];
  for (let n = 1; n <= 120; n++) {
    dampMoving(state, speed * n * dt, speed, 24, dt);
    if (n > 20) speeds.push(state.velocity);
  }
  assert.ok(Math.max(...speeds) - Math.min(...speeds) < .1, "Steady input has a continuous velocity instead of restarting from zero");
  assert.ok(Math.abs(state.value - 60) < .001);
  const before = state.value;
  dampMoving(state, 60, 0, 24, dt);
  assert.ok(state.value > before && state.velocity > 0, "Release brakes the existing motion rather than snapping its velocity");
  for (let n = 0; n < 120; n++) dampMoving(state, 60, 0, 24, dt);
  assert.ok(Math.abs(state.value - 60) < .001 && Math.abs(state.velocity) < .001);
});
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
  assert.equal(normalizePreferences({ volume: 10 }).volume, 6);
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
