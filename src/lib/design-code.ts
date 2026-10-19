import {
  defaultDesign,
  designSchema,
} from "../../supabase/functions/_shared/schema.ts";
export const designProperties = {
  background: "--color-bg",
  surface: "--color-surface",
  raised: "--color-raised",
  text: "--color-text",
  muted: "--color-muted",
  accent: "--color-accent",
  width: "--page-width",
  radius: "--radius",
} as const;
export function designToCss(design = defaultDesign): string {
  return `.site {\n${Object.entries(designProperties)
    .map(
      ([key, property]) =>
        `  ${property}: ${design[key as keyof typeof design]}${key === "width" || key === "radius" ? "px" : ""};`,
    )
    .join("\n")}\n}`;
}
/** Deliberately a typed CSS-variable language: no selectors, URLs, scripts or imports. */
export function parseDesignCss(source: string) {
  if (source.length > 4000) throw new Error("CSS 超過 4,000 字元。");
  const match = /^\s*\.site\s*\{([^{}]*)\}\s*$/.exec(source);
  if (!match)
    throw new Error("請保留單一 .site { … } 區塊，只編輯列出的 CSS 變數。");
  const result: Record<string, string | number> = {};
  for (const declaration of match[1].split(";").filter((s) => s.trim())) {
    const pair = /^\s*(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{6}|\d+px)\s*$/.exec(
      declaration,
    );
    if (!pair)
      throw new Error(
        "CSS 值只接受六位色碼或整數 px，不接受外部資源與任意規則。",
      );
    const key = Object.entries(designProperties).find(
      ([, value]) => value === pair[1],
    )?.[0];
    if (!key || key in result)
      throw new Error(`未知或重複的 CSS 變數：${pair[1]}`);
    result[key] = /px$/.test(pair[2]) ? Number(pair[2].slice(0, -2)) : pair[2];
  }
  return designSchema.parse(result);
}
