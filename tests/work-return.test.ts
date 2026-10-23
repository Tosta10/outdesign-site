import { test } from "node:test";
import assert from "node:assert/strict";
import { archivePresence, advanceModelReveal } from "../src/lib/work-lab/scene-transition.ts";

test("returning to the archive preserves the current clear or partial image", () => {
  for (const current of [0, .25, .7, 1]) {
    for (const hz of [5, 30, 60, 120]) {
      let reveal = current;
      for (let frame = 0; frame < hz * 3; frame++) {
        reveal = advanceModelReveal(reveal, "browse", Math.exp(-frame / hz), 4.05, 1 / hz, .8);
        assert.equal(reveal, current, "Closing must not restart the frosted decryption shader");
      }
    }
  }
});

test("archive coverage has no visibility jump at the old .995 threshold", () => {
  assert.equal(archivePresence(0), 1);
  assert.equal(archivePresence(.65), 1);
  assert.equal(archivePresence(1), 0);
  let previous = archivePresence(1);
  for (let frame = 1; frame <= 100; frame++) {
    const next = archivePresence(1 - frame / 100);
    assert.ok(next >= previous && next - previous < .05);
    previous = next;
  }
  assert.ok(Math.abs(archivePresence(.9949) - archivePresence(.9951)) < .0001);
});

test("opening can resume an interrupted reveal without resetting it", () => {
  const partial = advanceModelReveal(.25, "detail", .9, 4, .1, .8);
  const returning = advanceModelReveal(partial, "browse", .85, 3.8, .1, .8);
  assert.equal(returning, partial);
  assert.ok(advanceModelReveal(returning, "detail", .9, 4, .1, .8) > partial);
  assert.equal(advanceModelReveal(.9, "detail", 1, 4, 1, .01), 1);
  assert.equal(advanceModelReveal(1, "browse", .0009, .4, .1, .8), 0, "Reset the opening only after the model has handed back to the archive");
});
