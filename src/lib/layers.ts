import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { descendants } from "./workspace.ts";

export type LayerValues = NonNullable<
  NonNullable<SiteContent["presentation"]>["elements"]
>[string];
export type LayerItem = {
  key: string;
  selection: Selection;
  name: string;
  parent: string | null;
  locked: boolean;
  hidden: boolean;
  deleted: boolean;
};
export const layerNames: Record<string, string> = {
  "lab-header": "作品頁首",
  "lab-brand": "展示品牌",
  "lab-body": "作品內容",
  "lab-scene": "3D 卡帶場景",
  "lab-scene-caption": "場景說明",
  "lab-back": "返回陣列",
  "lab-object-caption": "卡帶說明",
  "lab-view-controls": "卡帶控制",
  "lab-browse-info": "目前作品資訊",
  "lab-detail": "作品資料",
  "lab-counter": "作品計數",
  "lab-navigation": "上下導覽",
  "lab-hint": "操作提示",
  "lab-powered": "展示署名",
  "lab-columns": "分類導覽",
  "lab-footer": "展示頁尾",
  "lab-inspection": "360° 檢視介面",
  "lab-document": "作品文件",
  "lab-menu": "網站導覽",

  header: "頁首",
  brand: "品牌與 Logo",
  "brand-logo": "Logo 圖像",
  "menu-button": "導覽選單按鈕",
  hero: "首頁主視覺",
  "hero-image": "形體主視覺",
  "hero-copy": "主視覺文字",
  mission: "作品入口",
  "mission-image": "介紹圖片",
  "hero-bottom": "捲動提示",
  footer: "頁尾",
  "footer-copyright": "版權文字",
  "footer-top": "回到頂端",
  work: "作品區塊",
  notes: "筆記區塊",
  about: "關於區塊",
  contact: "聯絡區塊",
  attachments: "資源區塊",
  music: "音樂播放器",
  "page-intro": "頁面標題",
};
export function selectionKey(selection: Selection, page: string): string {
  if (selection === "projects") return "work";
  if (selection.startsWith("element:")) return selection.slice(8);
  if (selection.startsWith("copy:")) return `copy-${selection.slice(5)}`;
  if (selection.includes(":")) return selection.replace(":", "-");
  return selection === "about" && page === "home"
    ? "mission"
    : selection === "settings"
      ? "brand"
      : selection;
}
export function patchLayer(
  content: SiteContent,
  key: string,
  patch: Partial<LayerValues>,
) {
  content.presentation ||= {};
  content.presentation.elements ||= {};
  content.presentation.elements[key] = {
    ...content.presentation.elements[key],
    ...patch,
  };
}
export function collectLayers(
  content: SiteContent,
  root: HTMLElement,
): LayerItem[] {
  const items: LayerItem[] = [],
    seen = new Set<string>();
  root.querySelectorAll<HTMLElement>("[data-element-key]").forEach((el) => {
    if (el.closest("dialog") || seen.has(el.dataset.elementKey!)) return;
    const key = el.dataset.elementKey!;
    seen.add(key);
    const values = content.presentation?.elements?.[key];
    const node = key.startsWith("node-")
      ? content.workspace?.nodes.find((n) => n.id === key.slice(5))
      : undefined;
    const selection = (el.dataset.edit || `element:${key}`) as Selection;
    items.push({
      key,
      selection,
      name:
        values?.name ||
        node?.name ||
        layerNames[key] ||
        (key.startsWith("project-")
          ? content.projects.find((p) => p.id === key.slice(8))?.title
          : "") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("data-field") ||
        el.textContent?.trim().slice(0, 28) ||
        key,
      parent:
        el.parentElement?.closest<HTMLElement>("[data-element-key]")?.dataset
          .elementKey || null,
      locked: Boolean(values?.locked || node?.locked),
      hidden: Boolean(values?.hidden || node?.hidden),
      deleted: Boolean(values?.deleted),
    });
  });
  return items;
}
export function removeLayer(
  content: SiteContent,
  selection: Selection,
  page: string,
) {
  const key = selectionKey(selection, page);
  if (content.presentation?.elements?.[key]?.locked) return;
  if (selection.startsWith("node:")) {
    const id = selection.slice(5),
      node = content.workspace?.nodes.find((n) => n.id === id);
    if (!node || node.locked) return;
    const ids = new Set([id, ...descendants(content.workspace!.nodes, id)]);
    content.workspace!.nodes = content.workspace!.nodes.filter(
      (n) => !ids.has(n.id),
    );
    for (const deleted of ids)
      if (content.presentation?.elements)
        delete content.presentation.elements[`node-${deleted}`];
    content.workspace!.scripts = content.workspace!.scripts?.filter(
      (s) => !ids.has(s.target.replace(/^node:/, "")),
    );
  } else patchLayer(content, key, { deleted: true });
}
/** Reparent only custom nodes. Original DOM structure remains semantic; its sibling order is editable. */
export function reorderLayer(
  content: SiteContent,
  from: LayerItem,
  to: LayerItem,
  nest = false,
  after = false,
) {
  if (from.key === to.key || from.locked || from.deleted) return;
  if (from.key.startsWith("node-") && to.key.startsWith("node-")) {
    const nodes = content.workspace!.nodes,
      a = nodes.find((n) => n.id === from.key.slice(5))!,
      b = nodes.find((n) => n.id === to.key.slice(5))!;
    if (!a || !b || descendants(nodes, a.id).includes(b.id)) return;
    a.parent = nest && b.type === "frame" ? b.id : b.parent;
    const index = nodes.indexOf(a);
    nodes.splice(index, 1);
    nodes.splice(nodes.indexOf(b) + (nest || after ? 1 : 0), 0, a);
  } else if (
    ["work", "notes", "about", "contact", "attachments"].includes(from.key) &&
    ["work", "notes", "about", "contact", "attachments"].includes(to.key)
  ) {
    const list =
      content.layout?.sections ||
      (["work", "notes", "about", "attachments", "contact"] as const);
    const order = [...list];
    const a = order.indexOf(from.key as never);
    order.splice(a, 1);
    order.splice(
      order.indexOf(to.key as never) + (after ? 1 : 0),
      0,
      from.key as never,
    );
    content.layout = { sections: order };
  } else if (
    (from.key.startsWith("project-") && to.key.startsWith("project-")) ||
    (from.key.startsWith("note-") && to.key.startsWith("note-"))
  ) {
    const list = from.key.startsWith("project-")
      ? content.projects
      : content.notes;
    const a = list.findIndex((i) => from.key.endsWith(i.id)),
      b = list.find((i) => to.key.endsWith(i.id));
    if (a >= 0 && b) {
      const [item] = list.splice(a, 1);
      (list as typeof content.projects).splice(
        list.indexOf(b as never) + (after ? 1 : 0),
        0,
        item as never,
      );
    }
  } else if (from.parent === to.parent) {
    // Ordered flex/grid siblings and z-order use the same stable numeric layer order.
    const order = content.presentation?.elements?.[to.key]?.order || 0;
    patchLayer(content, from.key, {
      order: Math.max(-200, Math.min(200, order + (after ? 1 : -1))),
      zIndex: Math.max(-100, Math.min(999, order + (after ? 1 : -1))),
    });
  }
}
