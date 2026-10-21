import type { CSSProperties } from "react";
import type { CanvasNode } from "../../supabase/functions/_shared/schema";
import type { SectionProps } from "./ContentSection";
import { appearanceStyle, elementProps } from "../lib/presentation";
import { assetUrl } from "../lib/content";

export function CanvasPanels({
  content,
  page,
  api = "",
  base = "/",
  editing = false,
  selected = "",
  privateAssets = {},
}: SectionProps & { page: string }) {
  const nodes = (content.workspace?.nodes || []).filter(
    (node) => node.page === page,
  );
  // Index once: nested rendering stays O(n), instead of scanning all nodes per child.
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const byParent = new Map<string | null, CanvasNode[]>();
  for (const node of nodes) {
    const siblings = byParent.get(node.parent) || [];
    siblings.push(node);
    byParent.set(node.parent, siblings);
  }
  const render = (node: CanvasNode) => {
    const parent = node.parent ? byId.get(node.parent) : undefined;
    const free = parent?.layout === "free";
    const children = byParent.get(node.id) || [];
    const style: CSSProperties = {
      "--node-x": `${node.x}%`,
      "--node-y": `${node.y}px`,
      "--node-w": `${node.width}px`,
      "--node-h": `${node.height}px`,
      "--node-gap": `${node.gap}px`,
      "--node-pad": `${node.padding}px`,
      "--node-cols": node.columns,
      "--node-radius": `${node.radius}px`,
      "--node-font": `${node.fontSize}px`,
      ...appearanceStyle(node.appearance),
      opacity: node.opacity,
      alignItems: node.align,
      textAlign:
        node.align === "start"
          ? "left"
          : node.align === "end"
            ? "right"
            : "center",
    } as CSSProperties;
    return (
      <div
        key={node.id}
        className={`canvas-node node-${node.type} node-flow-${node.layout} node-fill-${node.fill} node-size-${node.sizing} ${free ? "node-free" : ""} ${node.border ? "node-border" : ""} ${node.hidden ? "node-hidden" : ""} ${editing ? "editable" : ""} ${selected === `node:${node.id}` ? "is-selected" : ""}`}
        {...elementProps(content, `node-${node.id}`, editing)}
        style={{
          ...style,
          ...elementProps(content, `node-${node.id}`, editing).style,
        }}
        data-node-id={node.id}
        data-node-name={`${node.name} · ${Math.round(node.width)}×${Math.round(node.height)}`}
        data-layout={`node:${node.id}`}
        data-edit={editing ? `node:${node.id}` : undefined}
        data-locked={node.locked}
        data-optical-card={node.type === "frame" ? true : undefined}
        data-effect={node.appearance?.effect}
      >
        {editing && !node.locked && free && (
          <button
            className="free-move-handle"
            data-free-move={node.id}
            aria-label={`移動圖層：${node.name}`}
            title="拖曳移動；方向鍵微調"
          >
            ⠿ {node.name}
          </button>
        )}
        {node.type === "frame" ? (
          <>
            {editing && children.length === 0 && (
              <span className="empty-frame-label">
                {node.name} · 選取後新增子圖層
              </span>
            )}
            {children.map(render)}
          </>
        ) : node.type === "text" ? (
          <p className="preserve-lines">{node.body}</p>
        ) : node.type === "image" ? (
          node.image ? (
            <img
              src={assetUrl(node.image, api, base, privateAssets)}
              alt={node.alt}
              width={node.width}
              height={node.height}
              loading="lazy"
            />
          ) : editing ? (
            <p className="empty-frame-label">設定圖片網址或套用素材</p>
          ) : null
        ) : node.type === "link" ? (
          <a
            href={node.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            {node.body || node.name}
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : (
          <hr />
        )}
        {editing && free && !node.locked && (
          <button
            className="free-resize-handle"
            data-free-resize={node.id}
            aria-label={`調整尺寸：${node.name}`}
            title="拖曳調整寬高"
          />
        )}
      </div>
    );
  };
  return byParent.has(null) ? (
    <div className="custom-panels section-shell" data-custom-panels>
      {byParent.get(null)!.map(render)}
    </div>
  ) : null;
}
