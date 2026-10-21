import { useEffect, useState, type RefObject } from "react";
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
    [message, setMessage] = useState("");
  useEffect(() => {
    if (root.current) setItems(collectLayers(content, root.current));
  }, [content, page, root]);
  const selectedKey = selectionKey(selection, page);
  const selected = items.find((i) => i.key === selectedKey);
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
  const rows = (parent: string | null, depth = 0): React.ReactNode =>
    (children.get(parent) || []).map((item) => {
      const hasChildren = children.has(item.key),
        visible =
          !search || item.name.toLowerCase().includes(search.toLowerCase());
      return (
        <div key={item.key}>
          {visible && (
            <div
              className={`ps-layer-row ${selectedKey === item.key ? "selected" : ""} ${item.deleted ? "deleted" : ""}`}
              style={{ "--depth": depth } as React.CSSProperties}
              draggable={!item.locked}
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
                if (!from) return;
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
                aria-label={`展開圖層：${item.name}`}
                aria-expanded={hasChildren ? !closed.has(item.key) : undefined}
                onClick={() => toggle(item.key)}
                disabled={!hasChildren}
              >
                {hasChildren ? (closed.has(item.key) ? "▸" : "▾") : "·"}
              </button>
              <button
                className="layer-select"
                aria-label={`選取圖層：${item.name}`}
                aria-pressed={selectedKey === item.key}
                onClick={() => select(item.selection)}
              >
                <span className="layer-thumbnail">
                  {hasChildren ? "▣" : "▤"}
                </span>
                <span>{item.name}</span>
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
          )}
          {(!closed.has(item.key) || search) && rows(item.key, depth + 1)}
        </div>
      );
    });
  return (
    <div className="layer-explorer">
      <input
        className="layer-search"
        aria-label="搜尋圖層"
        placeholder="搜尋圖層…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="layer-tree-scroll">{rows(null)}</div>
      <div className="layer-bottom-actions">
        <span>{items.length} 個圖層</span>
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
            disabled={!selected || selected.locked}
            onClick={remove}
            aria-label="刪除選取圖層"
          >
            刪除
          </button>
        )}
      </div>
      <p className="layer-hint">拖曳調整順序 · Shift 拖入自訂群組</p>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
