import type {
  CanvasNode,
  Selection,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import { WorkLabPanel } from "./WorkLabPanel";
import { SourceProperties } from "./LayerProperties";
import { PresentationPanel } from "./PresentationPanel";
import { AppearanceFields } from "./AppearanceFields";
export function LogicObjectProperties({
  content,
  target,
  update,
}: {
  content: SiteContent;
  target: string;
  update: (fn: (c: SiteContent) => void) => void;
}) {
  const node = target.startsWith("node:")
    ? content.workspace?.nodes.find((n) => n.id === target.slice(5))
    : undefined;
  const patch = (value: Partial<CanvasNode>) =>
    update((next) => {
      const n = next.workspace?.nodes.find((n) => n.id === node?.id);
      if (n) Object.assign(n, value);
    });
  return (
    <details className="logic-object-properties">
      <summary>物件內容與外觀</summary>
      {(target === "projects" || target === "element:work" || target.startsWith("element:lab-")) && <WorkLabPanel content={content} update={update} />}
      {node ? (
        <div className="logic-properties">
          <label>
            物件圖層名稱
            <input
              aria-label="積木物件名稱"
              value={node.name}
              maxLength={60}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </label>
          {node.type === "image" && (
            <>
              <label>
                圖片網址
                <input
                  aria-label="積木圖片網址"
                  value={node.image}
                  onChange={(e) => patch({ image: e.target.value })}
                />
              </label>
              <label>
                替代文字
                <input
                  aria-label="積木圖片替代文字"
                  value={node.alt}
                  maxLength={160}
                  onChange={(e) => patch({ alt: e.target.value })}
                />
              </label>
            </>
          )}
          {["text", "link"].includes(node.type) && (
            <label>
              文字內容
              <textarea
                aria-label="積木物件文字"
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
                aria-label="積木物件連結"
                value={node.url}
                onChange={(e) => patch({ url: e.target.value })}
              />
            </label>
          )}
          {node.type === "frame" && (
            <label>
              面板排版
              <select
                aria-label="積木物件排版"
                value={node.layout}
                onChange={(e) =>
                  patch({ layout: e.target.value as CanvasNode["layout"] })
                }
              >
                <option value="vertical">垂直</option>
                <option value="horizontal">水平</option>
                <option value="grid">網格</option>
                <option value="free">自由定位</option>
              </select>
            </label>
          )}
          <AppearanceFields
            values={node.appearance}
            patch={(value) =>
              patch({ appearance: { ...node.appearance, ...value } })
            }
          />
        </div>
      ) : target.startsWith("element:") ? (
        <SourceProperties
          content={content}
          selection={target as Selection}
          update={update}
        />
      ) : target.startsWith("copy:") ? (
        <PresentationPanel
          content={content}
          selection={target as Selection}
          update={update}
        />
      ) : (
        <p>可在圖層模式展開此物件，編輯內部的個別內容。</p>
      )}
    </details>
  );
}
