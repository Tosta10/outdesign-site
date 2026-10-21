import { AppearanceFields } from "./AppearanceFields";
import { AssemblyPanel } from "./AssemblyPanel";
import { useState } from "react";
import { createCanvasNode, descendants } from "../lib/workspace";
import type {
  CanvasNode,
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import type { SitePage } from "../components/SiteRenderer";
type Update = (mutate: (content: SiteContent) => void) => void;

export function LayerTree({
  content,
  page,
  selected,
  select,
}: {
  content: SiteContent;
  page: SitePage;
  selected: Selection;
  select: (value: Selection) => void;
}) {
  const nodes = (content.workspace?.nodes || []).filter(
    (node) => node.page === page,
  );
  const layer = (parent: string | null, depth = 0): React.ReactNode =>
    nodes
      .filter((node) => node.parent === parent)
      .map((node) => (
        <div key={node.id}>
          <button
            className={`node-layer ${selected === `node:${node.id}` ? "selected" : ""}`}
            style={{ paddingLeft: 12 + depth * 12 }}
            aria-pressed={selected === `node:${node.id}`}
            aria-label={`選取圖層：${node.name}`}
            onClick={() => select(`node:${node.id}`)}
          >
            <span>{node.type === "frame" ? "▣" : "▤"}</span>
            {node.name}
            <small>{node.locked ? "鎖定" : node.hidden ? "隱藏" : ""}</small>
          </button>
          {layer(node.id, depth + 1)}
        </div>
      ));
  return <div className="node-layers">{layer(null)}</div>;
}
function NumberField({
  label,
  value,
  min = 0,
  max = 1600,
  change,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  change: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          if (e.target.value !== "")
            change(Math.min(max, Math.max(min, Number(e.target.value))));
        }}
      />
    </label>
  );
}
export function WorkspacePanel({
  content,
  page,
  selection,
  select,
  update,
}: {
  content: SiteContent;
  page: SitePage;
  selection: Selection;
  select: (value: Selection) => void;
  update: Update;
}) {
  const nodes = content.workspace?.nodes || [];
  const node = nodes.find((item) => `node:${item.id}` === selection);
  const [addToRoot, setAddToRoot] = useState(false);
  const patch = (values: Partial<CanvasNode>) =>
    update((next) => {
      const target = next.workspace?.nodes.find((item) => item.id === node?.id);
      if (target) Object.assign(target, values);
    });
  const add = (type: CanvasNode["type"]) => {
    if (nodes.length >= 100) return;
    const parent = addToRoot
      ? null
      : node?.type === "frame"
        ? node.id
        : node?.parent || null;
    const created = createCanvasNode(page, type, parent);
    if (nodes.find((item) => item.id === parent)?.layout === "free") {
      created.sizing = "fixed";
      created.x = 4;
      created.y =
        24 + nodes.filter((item) => item.parent === parent).length * 32;
    }
    update((next) => {
      next.workspace ||= { nodes: [] };
      next.workspace.nodes.push(created);
    });
    select(`node:${created.id}`);
  };
  const settings = content.workspace?.pages?.[page] || {
    gap: 32,
    padding: 48,
    builtins: true,
    position: "after" as const,
  };
  const setPage = (patch: Partial<typeof settings>) =>
    update((next) => {
      next.workspace ||= { nodes: [] };
      next.workspace.pages ||= Object.fromEntries(
        ["home", "work", "journal", "about", "resources"].map((key) => [
          key,
          { gap: 32, padding: 48, builtins: true, position: "after" },
        ]),
      ) as NonNullable<SiteContent["workspace"]>["pages"];
      next.workspace.pages![page] = { ...settings, ...patch };
    });
  return (
    <div className="advanced-panel layout-properties">
      <details className="add-node-tools" open={!node}>
        <summary>{node ? "加入子積木" : "新增基本積木"}</summary>
        <h3>新增圖層</h3>
        <p className="panel-help">
          選取面板後新增的內容會放進該面板。自由定位支援拖曳與右下角縮放；手機自動改為閱讀順序。
        </p>
        <label className="advanced-check">
          <input
            type="checkbox"
            checked={addToRoot}
            onChange={(e) => setAddToRoot(e.target.checked)}
          />
          新增至頁面最外層
        </label>
        <div className="node-add-grid">
          {(
            [
              ["frame", "新增面板"],
              ["text", "新增文字"],
              ["image", "新增圖片"],
              ["link", "新增連結"],
              ["divider", "新增分隔線"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              className="panel-secondary"
              disabled={nodes.length >= 100}
              onClick={() => add(type)}
            >
              {label}
            </button>
          ))}
        </div>
      </details>
      {node && (
        <>
          <h3>圖層屬性 · {node.name}</h3>
          <button
            className="panel-danger"
            disabled={node.locked}
            onClick={() => {
              const ids = new Set([node.id, ...descendants(nodes, node.id)]);
              update((next) => {
                next.workspace!.nodes = next.workspace!.nodes.filter(
                  (item) => !ids.has(item.id),
                );
              });
              select(node.parent ? `node:${node.parent}` : "settings");
            }}
          >
            刪除此{node.type === "frame" ? "面板" : "積木"}（可復原）
          </button>
          {node.type === "frame" && (
            <AssemblyPanel
              key={node.id}
              content={content}
              node={node}
              update={update}
            />
          )}
          <details>
            <summary>顏色、邊框與效果</summary>
            <AppearanceFields
              values={node.appearance}
              patch={(values) =>
                patch({ appearance: { ...node.appearance, ...values } })
              }
            />
            <button
              className="panel-secondary"
              onClick={() => patch({ appearance: undefined })}
            >
              還原面板外觀
            </button>
          </details>
          <label>
            圖層名稱
            <input
              aria-label="圖層名稱"
              value={node.name}
              maxLength={60}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          <div className="property-grid">
            <label className="advanced-check">
              <input
                type="checkbox"
                checked={node.locked}
                onChange={(e) => patch({ locked: e.target.checked })}
              />
              鎖定圖層
            </label>
            <label className="advanced-check">
              <input
                type="checkbox"
                checked={node.hidden}
                onChange={(e) => patch({ hidden: e.target.checked })}
              />
              隱藏圖層
            </label>
          </div>
          <label>
            父層面板
            <select
              aria-label="父層面板"
              value={node.parent || ""}
              onChange={(e) => patch({ parent: e.target.value || null })}
            >
              <option value="">頁面最外層</option>
              {nodes
                .filter(
                  (item) =>
                    item.page === page &&
                    item.type === "frame" &&
                    item.id !== node.id &&
                    !descendants(nodes, node.id).includes(item.id),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {node.type === "frame" && (
            <>
              <label>
                排版模式
                <select
                  aria-label="排版模式"
                  value={node.layout}
                  onChange={(e) =>
                    patch({ layout: e.target.value as CanvasNode["layout"] })
                  }
                >
                  <option value="vertical">Auto Layout · 垂直</option>
                  <option value="horizontal">Auto Layout · 水平換行</option>
                  <option value="grid">Grid · 網格</option>
                  <option value="free">自由定位 · X / Y</option>
                </select>
              </label>
              <div className="property-grid">
                <NumberField
                  label="內距"
                  value={node.padding}
                  max={120}
                  change={(padding) => patch({ padding })}
                />
                <NumberField
                  label="圖層間距"
                  value={node.gap}
                  max={120}
                  change={(gap) => patch({ gap })}
                />
                {node.layout === "grid" && (
                  <NumberField
                    label="網格欄數"
                    value={node.columns}
                    min={1}
                    max={6}
                    change={(columns) =>
                      patch({ columns: Math.round(columns) })
                    }
                  />
                )}
              </div>
            </>
          )}
          <label>
            寬度行為
            <select
              aria-label="寬度行為"
              value={node.sizing}
              onChange={(e) =>
                patch({ sizing: e.target.value as CanvasNode["sizing"] })
              }
            >
              <option value="fill">填滿容器</option>
              <option value="fixed">固定尺寸</option>
              <option value="hug">貼合內容</option>
            </select>
          </label>
          <div className="property-grid">
            <NumberField
              label="寬度 px"
              value={node.width}
              min={80}
              change={(width) => patch({ width })}
            />
            <NumberField
              label="高度 px"
              value={node.height}
              min={40}
              max={2000}
              change={(height) => patch({ height })}
            />
            <NumberField
              label="X 位置 %"
              value={node.x}
              max={100}
              change={(x) => patch({ x })}
            />
            <NumberField
              label="Y 位置 px"
              value={node.y}
              max={3000}
              change={(y) => patch({ y })}
            />
          </div>
          <label>
            對齊
            <select
              aria-label="對齊"
              value={node.align}
              onChange={(e) =>
                patch({ align: e.target.value as CanvasNode["align"] })
              }
            >
              <option value="start">起點／靠左</option>
              <option value="center">置中</option>
              <option value="end">終點／靠右</option>
            </select>
          </label>
          <label>
            表面色階
            <select
              aria-label="表面色階"
              value={node.fill}
              onChange={(e) =>
                patch({ fill: e.target.value as CanvasNode["fill"] })
              }
            >
              <option value="none">透明</option>
              <option value="surface">面板</option>
              <option value="raised">浮起層</option>
              <option value="accent">主題微光</option>
            </select>
          </label>
          <div className="property-grid">
            <NumberField
              label="圓角"
              value={node.radius}
              max={40}
              change={(radius) => patch({ radius })}
            />
            <NumberField
              label="字級"
              value={node.fontSize}
              min={12}
              max={96}
              change={(fontSize) => patch({ fontSize })}
            />
            <NumberField
              label="不透明度 %"
              value={Math.round(node.opacity * 100)}
              min={10}
              max={100}
              change={(opacity) => patch({ opacity: opacity / 100 })}
            />
            <label className="advanced-check">
              <input
                type="checkbox"
                checked={node.border}
                onChange={(e) => patch({ border: e.target.checked })}
              />
              細描邊
            </label>
          </div>
          {(node.type === "text" || node.type === "link") && (
            <label>
              圖層文字
              <textarea
                aria-label="圖層文字"
                value={node.body}
                maxLength={4000}
                onChange={(e) => patch({ body: e.target.value })}
              />
            </label>
          )}
          {node.type === "link" && (
            <label>
              連結網址
              <input
                aria-label="圖層連結網址"
                value={node.url}
                onChange={(e) => patch({ url: e.target.value })}
              />
            </label>
          )}
          {node.type === "image" && (
            <>
              <label>
                圖片網址
                <input
                  aria-label="圖層圖片網址"
                  value={node.image}
                  onChange={(e) => patch({ image: e.target.value })}
                />
              </label>
              <label>
                替代文字
                <input
                  aria-label="圖層替代文字"
                  value={node.alt}
                  onChange={(e) => patch({ alt: e.target.value })}
                />
              </label>
            </>
          )}
          <div className="code-actions">
            <button
              className="panel-secondary"
              disabled={
                nodes.length + descendants(nodes, node.id).length + 1 > 100
              }
              onClick={() => {
                const ids = [node.id, ...descendants(nodes, node.id)];
                const mapping = new Map(
                  ids.map((id) => [id, crypto.randomUUID()]),
                );
                const copies = nodes
                  .filter((item) => ids.includes(item.id))
                  .map((item) => ({
                    ...item,
                    id: mapping.get(item.id)!,
                    parent: mapping.get(item.parent || "") || item.parent,
                    name:
                      item.id === node.id
                        ? `${item.name.slice(0, 55)} 副本`
                        : item.name,
                  }));
                update((next) => next.workspace!.nodes.push(...copies));
                select(`node:${mapping.get(node.id)}`);
              }}
            >
              複製圖層
            </button>
          </div>
        </>
      )}
      <h3>目前頁面佈局</h3>
      <div className="property-grid">
        <NumberField
          label="面板間距"
          value={settings.gap}
          max={160}
          change={(gap) => setPage({ gap })}
        />
        <NumberField
          label="頁面上下留白"
          value={settings.padding}
          max={160}
          change={(padding) => setPage({ padding })}
        />
      </div>
      <label>
        自訂面板位置
        <select
          aria-label="自訂面板位置"
          value={settings.position}
          onChange={(e) =>
            setPage({ position: e.target.value as "before" | "after" })
          }
        >
          <option value="after">預設內容之後</option>
          <option value="before">預設內容之前</option>
        </select>
      </label>
      <label className="advanced-check">
        <input
          type="checkbox"
          checked={settings.builtins}
          onChange={(e) => setPage({ builtins: e.target.checked })}
        />
        顯示本頁預設內容（含主視覺）
      </label>
    </div>
  );
}
