import type {
  CanvasNode,
  SiteContent,
} from "../../supabase/functions/_shared/schema.ts";
export function createCanvasNode(
  page: CanvasNode["page"],
  type: CanvasNode["type"] = "frame",
  parent: string | null = null,
): CanvasNode {
  return {
    id: crypto.randomUUID(),
    page,
    parent,
    type,
    name: {
      frame: "新面板",
      text: "文字",
      image: "圖片",
      link: "連結",
      divider: "分隔線",
    }[type],
    body:
      type === "text"
        ? "在這裡寫下你的想法。"
        : type === "link"
          ? "探索更多"
          : "",
    url: "",
    image: "",
    alt: "",
    layout: "vertical",
    x: 0,
    y: 0,
    width: type === "frame" ? 1100 : 280,
    height: type === "frame" ? 480 : 160,
    sizing: "fill",
    gap: 24,
    padding: type === "frame" ? 32 : 0,
    columns: 2,
    align: "start",
    fill: type === "frame" ? "surface" : "none",
    border: type === "frame",
    radius: 12,
    fontSize: type === "text" ? 24 : 16,
    opacity: 1,
    hidden: false,
    locked: false,
  };
}
export function descendants(nodes: CanvasNode[], id: string): string[] {
  const result: string[] = [];
  const visit = (key: string) =>
    nodes
      .filter((node) => node.parent === key)
      .forEach((node) => {
        result.push(node.id);
        visit(node.id);
      });
  visit(id);
  return result;
}
export function selectedForPage(
  content: SiteContent,
  page: CanvasNode["page"],
) {
  return page === "home"
    ? "hero"
    : page === "work"
      ? content.projects[0]
        ? `project:${content.projects[0].id}`
        : "projects"
      : page === "journal"
        ? content.notes[0]
          ? `note:${content.notes[0].id}`
          : "notes"
        : page === "about"
          ? "about"
          : "attachments";
}
