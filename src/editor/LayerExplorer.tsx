import { useEffect, useRef, useState, type RefObject } from "react";
import { filterLayerTree, layerAncestors, type LayerFilter } from "./layer-tree";
import type {
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { contentSchema } from "../../supabase/functions/_shared/schema";
import {
  collectLayers,
  patchLayer,
  reorderLayer,
  selectionKey,
  type LayerItem,
} from "../lib/layers";
export function LayerExplorer({
  content,
  page,
  root,
  selection,
  select,
  update,
  remove,
}: {
  content: SiteContent;
  page: string;
  root: RefObject<HTMLDivElement | null>;
  selection: Selection;
  select: (s: Selection) => void;
  update: (fn: (c: SiteContent) => void) => void;
  remove: () => void;
}) {
  const [items, setItems] = useState<LayerItem[]>([]),
    [closed, setClosed] = useState<Set<string>>(new Set()),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<LayerFilter>("all"),
    [message, setMessage] = useState("");
  const tree = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (root.current) setItems(collectLayers(content, root.current));
  }, [content, page, root]);
  const selectedKey = selectionKey(selection, page);
  const selected = items.find((i) => i.key === selectedKey);
  const filtered = filterLayerTree(items, search, filter);
  const path = layerAncestors(items, selectedKey);
  const lockedKeys = new Set(items.filter((item) => item.locked).map((item) => item.key));
  const inheritedLock = (key: string) => layerAncestors(items, key).some((parent) => lockedKeys.has(parent));
  const selectedLocked = Boolean(selected?.locked || inheritedLock(selectedKey));
  useEffect(() => {
    const ancestors = layerAncestors(items, selectedKey);
    setClosed((old) => {
      if (!ancestors.some((key) => old.has(key))) return old;
      const next = new Set(old);
      ancestors.forEach((key) => next.delete(key));
      return next;
    });
    const frame = requestAnimationFrame(() => {
      tree.current?.querySelector<HTMLElement>(".ps-layer-row.selected")?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedKey, items]);
  const children = new Map<string | null, LayerItem[]>();
  const keys = new Set(items.map((i) => i.key));
  for (const item of items) {
    const parent = keys.has(item.parent || "") ? item.parent : null;
    const list = children.get(parent) || [];
    list.push(item);
    children.set(parent, list);
  }
  children.forEach((list) =>
    list.sort(
      (a, b) =>
        (content.presentation?.elements?.[a.key]?.order || 0) -
        (content.presentation?.elements?.[b.key]?.order || 0),
    ),
  );
  const toggle = (key: string) =>
    setClosed((old) => {
      const next = new Set(old);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const siblings = selected ? children.get(keys.has(selected.parent || "") ? selected.parent : null) || [] : [];
  const selectedIndex = siblings.findIndex((item) => item.key === selectedKey);
  const moveSelected = (direction: -1 | 1) => {
    const destination = siblings[selectedIndex + direction];
    if (!selected || !destination || selectedLocked || selected.deleted) return;
    const candidate = structuredClone(content);
    reorderLayer(candidate, selected, destination, false, direction > 0);
    if (!contentSchema.safeParse(candidate).success) {
      setMessage("此圖層無法移到該位置。");
      return;
    }
    update((next) => reorderLayer(next, selected, destination, false, direction > 0));
    setMessage(`已${direction < 0 ? "上移" : "下移"}「${selected.name}」。`);
  };
  const rows = (parent: string | null, depth = 0): React.ReactNode =>
    (children.get(parent) || []).map((item) => {
      if (!filtered.visible.has(item.key)) return null;
      const hasChildren = children.has(item.key);
      return (
        <div key={item.key}>
            <div
              className={`ps-layer-row ${selectedKey === item.key ? "selected" : ""} ${item.deleted ? "deleted" : ""} ${filtered.active && !filtered.matches.has(item.key) ? "layer-context" : ""}`}
              style={{ "--depth": depth } as React.CSSProperties}
              draggable={!item.locked && !inheritedLock(item.key) && !item.deleted && !filtered.active}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/outdesign-layer", item.key);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes("application/outdesign-layer")
                ) {
                  e.preventDefault();
                  e.currentTarget.classList.add("drop-target");
                  e.currentTarget.dataset.dropSide =
                    e.clientY >
                    e.currentTarget.getBoundingClientRect().top +
                      e.currentTarget.clientHeight / 2
                      ? "after"
                      : "before";
                }
              }}
              onDragLeave={(e) =>
                e.currentTarget.classList.remove("drop-target")
              }
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("drop-target");
                const from = items.find(
                  (i) =>
                    i.key ===
                    e.dataTransfer.getData("application/outdesign-layer"),
                );
                if (!from || inheritedLock(from.key)) return;
                const after =
                  e.clientY >
                  e.currentTarget.getBoundingClientRect().top +
                    e.currentTarget.clientHeight / 2;
                const candidate = structuredClone(content);
                reorderLayer(candidate, from, item, e.shiftKey, after);
                if (!contentSchema.safeParse(candidate).success) {
                  setMessage("此位置超過六層或形成循環，請選擇其他父層。");
                  return;
                }
                update((next) =>
                  reorderLayer(next, from, item, e.shiftKey, after),
                );
              }}
            >
              <button
                className="layer-fold"
                aria-label={`${closed.has(item.key) && !filtered.active ? "展開" : "收合"}圖層：${item.name}`}
                aria-expanded={hasChildren ? filtered.active || !closed.has(item.key) : undefined}
                onClick={() => toggle(item.key)}
                disabled={!hasChildren || filtered.active}
              >
                {hasChildren ? (closed.has(item.key) && !filtered.active ? "▸" : "▾") : "·"}
              </button>
              <button
                className="layer-select"
                aria-label={`選取圖層：${item.name}`}
                aria-pressed={selectedKey === item.key}
                onClick={() => select(item.selection)}
              >
                  <span className="layer-thumbnail" aria-hidden="true">
                  {hasChildren ? "▣" : "▤"}
                </span>
                <span title={item.name}>{item.name}</span>
              </button>
              <button
                className="layer-mini"
                aria-label={`${item.hidden ? "顯示" : "隱藏"}圖層：${item.name}`}
                aria-pressed={!item.hidden}
                onClick={() =>
                  update((next) => {
                    patchLayer(next, item.key, { hidden: !item.hidden });
                    const n = next.workspace?.nodes.find(
                      (n) => `node-${n.id}` === item.key,
                    );
                    if (n) n.hidden = !item.hidden;
                  })
                }
              >
                {item.hidden ? "○" : "◉"}
              </button>
              <button
                className="layer-mini"
                aria-label={`${item.locked ? "解鎖" : "鎖定"}圖層：${item.name}`}
                aria-pressed={item.locked}
                onClick={() =>
                  update((next) => {
                    patchLayer(next, item.key, { locked: !item.locked });
                    const n = next.workspace?.nodes.find(
                      (n) => `node-${n.id}` === item.key,
                    );
                    if (n) n.locked = !item.locked;
                  })
                }
              >
                {item.locked ? "▣" : "·"}
              </button>
            </div>
          {(!closed.has(item.key) || filtered.active) && rows(item.key, depth + 1)}
        </div>
      );
    });
  return (
    <div className="layer-explorer">
      <div className="author-section-label"><span>LAYERS</span><span>{items.length}</span></div>
      <input
        className="layer-search"
        aria-label="搜尋圖層"
        placeholder="搜尋圖層…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <label className="layer-filter">顯示範圍
        <select aria-label="圖層狀態篩選" value={filter} onChange={(e) => setFilter(e.target.value as LayerFilter)}>
          <option value="all">所有圖層</option><option value="hidden">隱藏的圖層</option><option value="locked">已鎖定的圖層</option><option value="deleted">已刪除的圖層</option>
        </select>
      </label>
      <div className="layer-result-count" aria-live="polite">{filtered.active ? `${filtered.matches.size} 個符合結果` : "依頁面結構排列"}{filtered.active && <button onClick={() => { setSearch(""); setFilter("all"); }}>清除篩選</button>}</div>
      <div className="layer-tree-scroll" ref={tree} role="group" aria-label="頁面圖層結構">
        {filtered.matches.size ? rows(null) : <p className="author-empty">找不到符合的圖層。<br />嘗試名稱、識別碼或其他狀態。</p>}
      </div>
      {selected && <div className="layer-selection-context">
        <span className="author-section-label">目前選取</span>
        <p title={[...path.map((key) => items.find((item) => item.key === key)?.name), selected.name].join(" / ")}>{selected.name}</p>
        <small>{path.length ? `${path.length} 層父項目 · ` : "頁面最外層 · "}{selected.deleted ? "已刪除" : selected.locked ? "已鎖定" : selectedLocked ? "父層已鎖定" : selected.hidden ? "已隱藏" : "可編輯"}</small>
        {!filtered.visible.has(selectedKey) && <button onClick={() => { setSearch(""); setFilter("all"); }}>顯示選取圖層</button>}
        <div className="layer-reorder-actions"><button disabled={selectedLocked || selected.deleted || selectedIndex <= 0} onClick={() => moveSelected(-1)} aria-label="選取圖層上移">↑ 上移</button><button disabled={selectedLocked || selected.deleted || selectedIndex < 0 || selectedIndex >= siblings.length - 1} onClick={() => moveSelected(1)} aria-label="選取圖層下移">↓ 下移</button></div>
      </div>}
      <div className="layer-bottom-actions">
        <span>{selectedLocked ? "已鎖定" : "選取項目操作"}</span>
        {selected?.deleted ? (
          <button
            onClick={() =>
              update((next) =>
                patchLayer(next, selected.key, { deleted: false }),
              )
            }
          >
            復原此圖層
          </button>
        ) : (
          <button
            disabled={!selected || selectedLocked}
            onClick={remove}
            aria-label="刪除選取圖層"
          >
            刪除
          </button>
        )}
      </div>
      <p className="layer-hint">{filtered.active ? "搜尋保留父層路徑；清除篩選後可拖曳。" : "拖曳調整順序 · Shift 拖入自訂群組"}</p>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
