import { useEffect, useMemo, useRef, useState } from "react";
import {
  contentSchema,
  defaultDesign,
  defaultInteractions,
  type SiteContent,
} from "../../supabase/functions/_shared/schema";
import type { SitePage } from "../components/SiteRenderer";
type Scope = "content" | "theme" | "media" | "interactions" | "layout";
function scoped(content: SiteContent, scope: Scope, page: SitePage): unknown {
  if (scope === "theme")
    return {
      theme: content.settings.theme,
      design: content.design || defaultDesign,
    };
  if (scope === "interactions")
    return content.interactions || defaultInteractions;
  if (scope === "layout") return content.workspace || { nodes: [] };
  if (scope === "media")
    return {
      heroImage: content.hero.image,
      music: content.music,
      projectImages: content.projects.map(({ id, image, alt }) => ({
        id,
        image,
        alt,
      })),
      canvasImages: (content.workspace?.nodes || [])
        .filter((node) => node.type === "image")
        .map(({ id, image, alt }) => ({ id, image, alt })),
      attachments: content.attachments,
    };
  return page === "home"
    ? { hero: content.hero }
    : page === "work"
      ? { projects: content.projects }
      : page === "journal"
        ? { notes: content.notes, showNotes: content.settings.showNotes }
        : page === "about"
          ? {
              about: content.about,
              contact: content.contact,
              music: content.music,
              showMusic: content.settings.showMusic,
            }
          : { attachments: content.attachments };
}
export function ScopedCode({
  content,
  scope,
  page,
  apply,
  onDirty,
}: {
  content: SiteContent;
  scope: Scope;
  page: SitePage;
  apply: (content: SiteContent) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [dirty, setDirty] = useState(false);
  const live = useMemo(
    () =>
      open || dirty
        ? JSON.stringify(scoped(content, scope, page), null, 2)
        : "",
    [content, scope, page, open, dirty],
  );
  const [source, setSource] = useState(""),
    [message, setMessage] = useState("");
  const baseline = useRef(live);
  useEffect(() => {
    if (!dirty && open) {
      baseline.current = live;
      setSource(live);
    }
  }, [live, dirty, open]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty]);
  const stale = baseline.current !== live;
  const commit = () => {
    try {
      if (stale) throw new Error("本面板資料已變更，請先載入目前資料。");
      if (source.length > 200000) throw new Error("代碼超過大小限制。");
      const value = JSON.parse(source),
        next = structuredClone(content);
      const expected = Object.keys(JSON.parse(live)).sort();
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        (scope === "layout"
          ? !Array.isArray(value.nodes) ||
            Object.keys(value).some(
              (key) => !["nodes", "pages", "presets"].includes(key),
            )
          : JSON.stringify(Object.keys(value).sort()) !==
            JSON.stringify(expected))
      )
        throw new Error("請保留此面板的欄位結構，完整整站編輯請使用代碼分頁。");
      if (scope === "theme") {
        next.settings.theme = value.theme;
        next.design = value.design;
      } else if (scope === "interactions") next.interactions = value;
      else if (scope === "layout") next.workspace = value;
      else if (scope === "media") {
        next.hero.image = value.heroImage;
        next.music = value.music;
        next.attachments = value.attachments;
        for (const item of value.projectImages) {
          const node = next.projects.find((p) => p.id === item.id);
          if (!node) throw new Error("作品 ID 不存在");
          if (
            Object.keys(item).some(
              (key) => !["id", "image", "alt"].includes(key),
            )
          )
            throw new Error("圖片欄位不正確");
          node.image = item.image;
          node.alt = item.alt;
        }
        for (const item of value.canvasImages) {
          const node = next.workspace?.nodes.find(
            (p) => p.id === item.id && p.type === "image",
          );
          if (!node) throw new Error("圖片圖層 ID 不存在");
          node.image = item.image;
          node.alt = item.alt;
        }
      } else {
        for (const [key, item] of Object.entries(value)) {
          if (key === "showNotes" || key === "showMusic")
            next.settings[key] = item as boolean;
          else (next as unknown as Record<string, unknown>)[key] = item;
        }
      }
      const parsed = contentSchema.safeParse(next);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      apply(parsed.data);
      baseline.current = JSON.stringify(
        scoped(parsed.data, scope, page),
        null,
        2,
      );
      setSource(baseline.current);
      setDirty(false);
      setMessage("已驗證並套用，可復原。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法解析代碼");
    }
  };
  return (
    <section className="scoped-code">
      <button
        className="panel-secondary"
        aria-expanded={open}
        onClick={() => {
          if (!open && !dirty) {
            const value = JSON.stringify(scoped(content, scope, page), null, 2);
            baseline.current = value;
            setSource(value);
          }
          setOpen(!open);
        }}
      >
        此面板的程式碼 {open ? "−" : "+"}
      </button>
      {open && (
        <div className="advanced-panel">
          <p className="panel-help">
            只修改目前面板資料。驗證成功才寫入草稿，發布後才會公開。
          </p>
          <textarea
            className="code-input"
            aria-label="面板程式碼"
            spellCheck={false}
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setDirty(true);
            }}
          />
          <div className="code-actions">
            <button className="panel-primary" disabled={stale} onClick={commit}>
              套用面板代碼
            </button>
            <button
              className="panel-secondary"
              onClick={() => {
                if (dirty && !window.confirm("捨棄尚未套用的面板代碼？"))
                  return;
                baseline.current = live;
                setSource(live);
                setDirty(false);
                setMessage("");
              }}
            >
              載入面板資料
            </button>
          </div>
          {stale && (
            <p className="studio-error">資料已更新，請先載入面板資料。</p>
          )}
          {message && (
            <p role="status" className="code-message">
              {message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
