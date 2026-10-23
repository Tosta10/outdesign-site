import type { LayerItem } from "../lib/layers";

export type LayerFilter = "all" | "hidden" | "locked" | "deleted";

/** Preserve the ancestry of matches so a filtered layer never loses its context. */
export function filterLayerTree(items: LayerItem[], query: string, filter: LayerFilter) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const byKey = new Map(items.map((item) => [item.key, item]));
  const matches = new Set<string>();
  const visible = new Set<string>();
  for (const item of items) {
    if (filter !== "all" && !item[filter]) continue;
    if (!terms.every((term) => `${item.name} ${item.key}`.toLocaleLowerCase().includes(term))) continue;
    matches.add(item.key);
    let current: LayerItem | undefined = item;
    const visited = new Set<string>();
    while (current && !visited.has(current.key)) {
      visited.add(current.key);
      visible.add(current.key);
      current = current.parent ? byKey.get(current.parent) : undefined;
    }
  }
  return { matches, visible, active: terms.length > 0 || filter !== "all" };
}

export function layerAncestors(items: LayerItem[], key: string): string[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const path: string[] = [];
  const seen = new Set([key]);
  let parent = byKey.get(key)?.parent;
  while (parent && !seen.has(parent)) {
    seen.add(parent);
    path.unshift(parent);
    parent = byKey.get(parent)?.parent;
  }
  return path;
}
