import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  SiteRenderer,
  pageNames,
  type SitePage,
} from "../components/SiteRenderer";
import type { SiteContent } from "../../supabase/functions/_shared/schema";
const PreviewRenderer = memo(SiteRenderer);
const documentSource =
  '<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="preview-root"></div></body></html>';
/** Isolated document: IDs and styles never collide with the author canvas.
 * The sandbox permits parent DOM rendering but no scripts or form submission.
 * Only schema-validated React content reaches this document. */
export function CodePreview({
  content,
  page,
  api,
  base,
  assets,
  error,
}: {
  content: SiteContent;
  page: SitePage;
  api: string;
  base: string;
  assets: Record<string, string>;
  error: string;
}) {
  const [document, setDocument] = useState<Document | null>(null);
  const [route, setRoute] = useState(page),
    [width, setWidth] = useState(390),
    [available, setAvailable] = useState(390);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setRoute(page);
  }, [page]);
  useEffect(() => {
    if (!viewport.current) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setAvailable(entry.contentRect.width));
    });
    observer.observe(viewport.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  const scale = Math.min(1, available / width);
  return (
    <section className="code-live-preview" aria-label="代碼即時預覽區">
      <div className="preview-heading">
        <strong>即時預覽</strong>
        <span role="status">
          {error ? "保留上次有效畫面" : "已同步 · 尚未套用"}
        </span>
      </div>
      <div className="preview-controls">
        <label>
          頁面
          <select
            aria-label="代碼預覽頁面"
            value={route}
            onChange={(e) => setRoute(e.target.value as SitePage)}
          >
            {Object.entries(pageNames).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          裝置
          <select
            aria-label="代碼預覽裝置"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          >
            <option value={390}>手機 390</option>
            <option value={1280}>桌面 1280</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="preview-validation" role="status">
          {error}
        </p>
      )}
      <div className="code-preview-viewport" ref={viewport}>
        <iframe
          title="代碼即時預覽"
          sandbox="allow-same-origin"
          srcDoc={documentSource}
          style={{
            width,
            height: Math.round(700 / scale),
            transform: `scale(${scale})`,
          }}
          onLoad={(event) => {
            const doc = event.currentTarget.contentDocument;
            if (!doc) return;
            window.document
              .querySelectorAll('link[rel="stylesheet"],style')
              .forEach((node) => {
                const clone = node.cloneNode(true) as HTMLElement;
                if (clone instanceof HTMLLinkElement)
                  clone.href = (node as HTMLLinkElement).href;
                doc.head.append(clone);
              });
            doc.body.inert = true;
            setDocument(doc);
          }}
        />
        {document &&
          createPortal(
            <div className="canvas-stage">
              <PreviewRenderer
                content={content}
                api={api}
                base={base}
                page={route}
                privateAssets={assets}
              />
            </div>,
            document.getElementById("preview-root")!,
          )}
      </div>
    </section>
  );
}
