import { test } from "node:test";
import assert from "node:assert/strict";
import { FrameFieldCache } from "../src/lib/work-lab/field-cache.ts";

test("frame field cache shares adjacent slope samples, invalidates time, and handles unbounded navigation", () => {
  const cache = new FrameFieldCache(9, 65);
  let calls = 0, time = 0;
  const calculate = (row: number, lane: number) => { calls++; return row * 2 + lane + time; };
  for (const [lane, row] of [[0, 0], [-100.2, -300.8], [3000.4, 99999.9]]) {
    cache.begin(lane, row);
    const l = Math.floor(lane), r = Math.floor(row);
    const before = calls;
    assert.equal(cache.read(r + .5, l, calculate), (r + .5) * 2 + l + time);
    assert.equal(cache.read(r + 1 - .5, l, calculate), (r + .5) * 2 + l + time);
    assert.equal(calls, before + 1, "Adjacent cells reuse one slope sample");
    for (const offset of [-32.5, 32.5, -400, .25])
      assert.equal(cache.read(r + offset, l, calculate), (r + offset) * 2 + l + time);
    time++;
    cache.begin(lane, row);
    assert.equal(cache.read(r + .5, l, calculate), (r + .5) * 2 + l + time);
  }
});
