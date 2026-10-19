import type { CSSProperties } from "react";
import type { CanvasNode } from "../../supabase/functions/_shared/schema";
import type { SectionProps } from "./ContentSection";
import { CanvasHandle } from "./CanvasHandle";
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
  const render = (node: CanvasNode) => {
    const parent = nodes.find((item) => item.id === node.parent);
    const free = parent?.layout === "free";
    const children = nodes.filter((item) => item.parent === node.id);
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
        style={style}
        data-node-id={node.id}
        data-layout={`node:${node.id}`}
        data-edit={editing ? `node:${node.id}` : undefined}
        data-locked={node.locked}
      >
        {editing &&
          !node.locked &&
          (free ? (
            <button
              className="free-move-handle"
              data-free-move={node.id}
              aria-label={`移動圖層：${node.name}`}
              title="拖曳移動；方向鍵微調"
            >
              ⠿ {node.name}
            </button>
          ) : (
            <CanvasHandle id={`node:${node.id}`} label={node.name} editing />
          ))}
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
  return nodes.some((node) => !node.parent) ? (
    <div className="custom-panels section-shell" data-custom-panels>
      {nodes.filter((node) => !node.parent).map(render)}
    </div>
  ) : null;
}
