import type { CanvasNode } from "../../supabase/functions/_shared/schema";
import { createCanvasNode } from "./workspace.ts";
export const blockRecipes = [
  { id: "text", name: "文字組", detail: "標題＋段落", shape: "text" },
  { id: "split", name: "圖文雙欄", detail: "並排圖像與敘事", shape: "split" },
  { id: "panel", name: "內容面板", detail: "標題、內容與外觀", shape: "panel" },
  { id: "columns", name: "三欄網格", detail: "可嵌套容器", shape: "columns" },
  { id: "cta", name: "行動入口", detail: "文字與連結", shape: "cta" },
] as const;
export type BlockRecipe = (typeof blockRecipes)[number]["id"];
/** Atomic recipe: IDs and parent relations are created together, so inserting,
 * duplicating or undoing a whole composition never leaves orphaned children. */
export function createBlockRecipe(
  recipe: BlockRecipe,
  page: CanvasNode["page"],
  parent: string | null = null,
): CanvasNode[] {
  const frame = createCanvasNode(page, "frame", parent);
  frame.name = blockRecipes.find((r) => r.id === recipe)!.name;
  const child = (type: CanvasNode["type"], body: string) => ({
    ...createCanvasNode(page, type, frame.id),
    body,
  });
  if (recipe === "columns") {
    frame.layout = "grid";
    frame.columns = 3;
    return [
      frame,
      ...["探索", "創作", "連結"].map((body) => child("text", body)),
    ];
  }
  if (recipe === "split") {
    frame.layout = "grid";
    frame.columns = 2;
    const image = child("image", "");
    image.image = "/assets/work-between.svg";
    image.alt = "銀色幾何材質研究";
    return [
      frame,
      image,
      child("text", "在設計與技術之間，\n讓想法成為作品。"),
    ];
  }
  const heading = child("text", "把想法組合成新的可能。");
  heading.fontSize = 32;
  const body = child(
    recipe === "cta" ? "link" : "text",
    recipe === "cta" ? "探索作品" : "點選任一積木，即時調整文字、尺寸與間距。",
  );
  if (recipe === "cta") body.url = "https://github.com/Tosta10/outdesign-site";
  return [frame, heading, body];
}
