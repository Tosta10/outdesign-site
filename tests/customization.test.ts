import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contentSchema,
  defaultDesign,
  defaultInteractions,
} from "../supabase/functions/_shared/schema.ts";
import { initialContent } from "../supabase/functions/_shared/seed.ts";
import { designToCss, parseDesignCss } from "../src/lib/design-code.ts";

test("customization stays optional and validates published interaction budgets", () => {
  assert.equal(contentSchema.safeParse(initialContent).success, true);
  const content = {
    ...initialContent,
    design: defaultDesign,
    interactions: defaultInteractions,
  };
  assert.equal(contentSchema.safeParse(content).success, true);
  for (const patch of [
    { tilt: 50 },
    { damping: 0 },
    { card: "webgl" },
    { ripple: "true" },
    { transition: "script" },
  ]) {
    assert.equal(
      contentSchema.safeParse({
        ...content,
        interactions: { ...defaultInteractions, ...patch },
      }).success,
      false,
    );
  }
  assert.equal(
    contentSchema.safeParse({
      ...content,
      design: { ...defaultDesign, width: 10000 },
    }).success,
    false,
  );
});
test("typed CSS round-trips and rejects injection, unknown declarations and invalid dimensions", () => {
  const source = designToCss();
  assert.deepEqual(parseDesignCss(source), defaultDesign);
  assert.equal(parseDesignCss(source.replace("1280px", "1200px")).width, 1200);
  for (const css of [
    source.replace("#0a0a0a", "url(https://evil.example)"),
    source.replace("--color-bg", "--unknown"),
    source.replace("1280px", "99999px"),
    source.replace("#0a0a0a", "expression(alert(1))"),
    source + " body {display:none}",
    source.replace(".site", "@import"),
    source.replace(
      "--color-bg: #0a0a0a;",
      "--color-bg: #0a0a0a; --color-bg: #ffffff;",
    ),
    source.replace("--color-bg: #0a0a0a;", ""),
  ])
    assert.throws(() => parseDesignCss(css));
});
