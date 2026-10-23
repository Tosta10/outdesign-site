import { memo, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SiteRenderer, type SitePage } from "../components/SiteRenderer";
import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { notifyRenderVisibility } from "../lib/render-visibility";

/** An isolated, passive viewport. Run preview opens the interactive scene separately. */
export const MiniPreview = memo(function MiniPreview(props: {
  content: SiteContent; page: SitePage; api: string; base: string;
  assets: Record<string, string>; onRun: () => void;
  suspended?: boolean;
}) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [width, setWidth] = useState(1280);
  const [zoom, setZoom] = useState(1);
  const [available, setAvailable] = useState(300);
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 600);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => { notifyRenderVisibility(); }, [props.suspended]);
  useEffect(() => {
    const compact = matchMedia("(max-width: 600px)");
    const collapse = () => { if (compact.matches) setOpen(false); };
    compact.addEventListener("change", collapse);
    return () => compact.removeEventListener("change", collapse);
  }, []);
  useEffect(() => {
    if (!viewport.current) return;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setAvailable(entry.contentRect.width));
    });
    observer.observe(viewport.current);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [open]);
  const scale = available / width * zoom;
  return <section className="logic-mini-preview" aria-label="積木即時預覽區" data-preview-open={open} data-render-suspended={props.suspended || undefined}>
    <div className="mini-preview-heading">
      <button aria-expanded={open} onClick={() => setOpen(!open)}>即時預覽 {open ? "▾" : "▸"}</button>
      <button onClick={props.onRun} title="開啟互動執行預覽">▶ 執行</button>
    </div>
    {open && <>
      <div className="mini-preview-controls">
        <select aria-label="即時預覽裝置" value={width} onChange={(e) => setWidth(Number(e.target.value))}>
          <option value={1280}>桌面</option><option value={768}>平板</option><option value={390}>手機</option>
        </select>
        <input className="author-range-control" aria-label="即時預覽縮放" aria-valuetext={`${Math.round(zoom * 100)}%`} type="range" min="0.5" max="2" step="0.1" value={zoom} style={{ "--range-progress": `${(zoom - .5) / 1.5 * 100}%` } as CSSProperties} onChange={(e) => setZoom(Number(e.target.value))} />
        <output>{Math.round(zoom * 100)}%</output>
      </div>
      <div ref={viewport} className="mini-preview-viewport">
        <div style={{ width: width * scale, height: 900 * scale }}>
          <iframe title="積木即時預覽" sandbox="allow-same-origin" tabIndex={-1}
            srcDoc={'<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="mini-root"></div></body></html>'}
            style={{ width, height: 900, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", border: 0 }}
            onLoad={(e) => {
              const document = e.currentTarget.contentDocument;
              if (!document) return;
              window.document.querySelectorAll('style,link[rel="stylesheet"]').forEach((node) => {
                const clone = node.cloneNode(true) as HTMLElement;
                if (clone.tagName === "LINK") (clone as HTMLLinkElement).href = (node as HTMLLinkElement).href;
                document.head.append(clone);
              });
              document.body.inert = true;
              setDoc(document);
            }} />
        </div>
        {doc && createPortal(<div className="canvas-stage"><SiteRenderer {...props} editing privateAssets={props.assets} /></div>, doc.getElementById("mini-root")!)}
      </div>
    </>}
  </section>;
});
