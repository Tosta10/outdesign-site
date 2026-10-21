import { useEffect, useMemo, useRef, useState } from "react";
import {
  contentSchema,
  defaultInteractions,
  type SiteContent,
} from "../../supabase/functions/_shared/schema";
import { CodePreview } from "./CodePreview";
import type { SitePage } from "../components/SiteRenderer";
import { designToCss, parseDesignCss } from "../lib/design-code";
import implementation from "../lib/effects.ts?raw";
import effectCss from "../styles/effects.css?raw";

type Update = (change: (next: SiteContent) => void) => void;
export function InteractionsPanel({
  content,
  update,
}: {
  content: SiteContent;
  update: Update;
}) {
  const effects = content.interactions || defaultInteractions;
  const [custom, setCustom] = useState(false);
  const set = (patch: Partial<typeof effects>) =>
    update((next) => {
      next.interactions = { ...effects, ...patch };
    });
  return (
    <div className="advanced-panel">
      <p className="panel-help">
        選擇一種卡片回饋即可。編輯畫布暫停傾斜，避免干擾拖曳；按頂部「預覽」可直接體驗。
      </p>
      <label>
        卡片互動
        <select
          aria-label="卡片互動"
          value={effects.card}
          onChange={(e) => set({ card: e.target.value as typeof effects.card })}
        >
          <option value="none">靜態 · 專注內容</option>
          <option value="lift">微浮起 · 3px</option>
          <option value="scale">輕微放大</option>
          <option value="glow">柔光回饋</option>
          <option value="outline">描邊強調</option>
          <option value="tilt">慣性傾斜 · 跟隨游標</option>
        </select>
      </label>
      {effects.card === "tilt" && (
        <>
          <label>
            傾斜角度：{effects.tilt}°
            <input
              aria-label="傾斜角度"
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={effects.tilt}
              onChange={(e) => set({ tilt: Number(e.target.value) })}
            />
          </label>
          <label>
            跟隨速度：{effects.damping.toFixed(2)}
            <input
              aria-label="跟隨速度"
              type="range"
              min="0.06"
              max="0.3"
              step="0.01"
              value={effects.damping}
              onChange={(e) => set({ damping: Number(e.target.value) })}
            />
          </label>
        </>
      )}
      <label>
        頁面切換
        <select
          aria-label="頁面切換"
          value={effects.transition}
          onChange={(e) =>
            set({ transition: e.target.value as typeof effects.transition })
          }
        >
          <option value="none">直接切換</option>
          <option value="fade">柔和淡入 · 180ms</option>
          <option value="slide">輕微上移 · 220ms</option>
        </select>
      </label>
      <label className="advanced-check">
        <input
          type="checkbox"
          checked={effects.press ?? effects.ripple ?? true}
          onChange={(e) => set({ press: e.target.checked })}
        />
        按壓回饋
      </label>
      <p className="panel-help">
        觸控裝置停用懸停效果；系統「減少動態效果」優先於以上設定。效果只在互動時更新。
      </p>
      <button
        className="panel-secondary"
        aria-expanded={custom}
        onClick={() => setCustom(!custom)}
      >
        自定義：檢視屬性與實作
      </button>
      {custom && (
        <>
          <h3>目前屬性</h3>
          <pre className="source-preview">
            {JSON.stringify(effects, null, 2)}
          </pre>
          <h3>TypeScript · 實際執行程式碼</h3>
          <pre className="source-preview">{implementation}</pre>
          <h3>CSS · 轉場與降級</h3>
          <pre className="source-preview">{effectCss}</pre>
        </>
      )}
    </div>
  );
}

export function CodePanel({
  content,
  apply,
  onDirty,
  page,
  api,
  base,
  assets,
}: {
  page: SitePage;
  api: string;
  base: string;
  assets: Record<string, string>;
  content: SiteContent;
  apply: (content: SiteContent) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [file, setFile] = useState<"content" | "css">("content");
  const [json, setJson] = useState(() => JSON.stringify(content, null, 2));
  const [css, setCss] = useState(() => designToCss(content.design));
  const [message, setMessage] = useState("");
  const [full, setFull] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [candidate, setCandidate] = useState(content);
  const [previewError, setPreviewError] = useState("");
  useEffect(() => {
    if (!full) return;
    const timer = setTimeout(() => {
      try {
        if (json.length > 200000) throw new Error("JSON 超過大小限制");
        const next =
          file === "content"
            ? JSON.parse(json)
            : { ...content, design: parseDesignCss(css) };
        const parsed = contentSchema.safeParse(next);
        if (!parsed.success)
          throw new Error(
            parsed.error.issues
              .slice(0, 2)
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join(" / "),
          );
        setCandidate(parsed.data);
        setPreviewError("");
      } catch (error) {
        setPreviewError(error instanceof Error ? error.message : "代碼無效");
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [json, css, file, full, content]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty]);
  const signature = useMemo(() => JSON.stringify(content), [content]);
  const baseline = useRef(signature);
  const stale = baseline.current !== signature;
  const workspace = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (full)
      workspace.current
        ?.querySelector<HTMLButtonElement>(".code-close")
        ?.focus();
  }, [full]);
  const refresh = () => {
    setJson(JSON.stringify(content, null, 2));
    setCss(designToCss(content.design));
    baseline.current = signature;
    setDirty(false);
    setMessage("已載入目前草稿。");
  };
  const commit = () => {
    try {
      if (stale)
        throw new Error(
          "草稿已在其他面板修改。請先載入目前草稿，再套用代碼，避免覆蓋新內容。",
        );
      if (json.length > 200000) throw new Error("JSON 超過 200,000 字元。");
      const candidate =
        file === "content"
          ? JSON.parse(json)
          : { ...content, design: parseDesignCss(css) };
      const parsed = contentSchema.safeParse(candidate);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .slice(0, 4)
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      apply(parsed.data);
      baseline.current = JSON.stringify(parsed.data);
      setJson(JSON.stringify(parsed.data, null, 2));
      setCss(designToCss(parsed.data.design));
      setDirty(false);
      setMessage("已套用至草稿並預覽。可用頂部復原；發布後才對訪客生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法解析代碼。");
    }
  };
  return (
    <div
      ref={workspace}
      role={full ? "dialog" : undefined}
      aria-modal={full ? true : undefined}
      aria-label={full ? "代碼工作區" : undefined}
      className={`advanced-panel code-workspace ${full ? "code-expanded" : ""}`}
      onKeyDown={(event) => {
        if (full && event.key === "Tab") {
          const items = [
            ...workspace.current!.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
            ),
          ].filter((el) => el.offsetParent !== null);
          if (event.shiftKey && document.activeElement === items[0]) {
            event.preventDefault();
            items.at(-1)?.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === items.at(-1)
          ) {
            event.preventDefault();
            items[0]?.focus();
          }
        }
        if (event.key === "Escape" && full) {
          event.stopPropagation();
          setFull(false);
        }
      }}
    >
      <div className="code-source-pane">
        <div className="code-heading">
          <h3>CODE WORKSPACE</h3>
          <button
            className={`panel-secondary ${full ? "code-close" : ""}`}
            aria-label={full ? "關閉代碼工作區" : "展開工作區"}
            aria-expanded={full}
            onClick={() => setFull(!full)}
          >
            {full ? "✕" : "展開工作區"}
          </button>
        </div>
        <p className="panel-help">
          整站 JSON 可批次編輯所有頁面內容、作品順序與交互設定。CSS
          變數控制全站色彩、內容寬度與圓角。套用會形成一個可復原的修改。
        </p>
        <label>
          編輯檔案
          <select
            aria-label="編輯檔案"
            value={file}
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm("切換檔案會捨棄尚未套用的代碼，確定繼續？")
              )
                return;
              refresh();
              setFile(e.target.value as typeof file);
              setMessage("");
            }}
          >
            <option value="content">content.json · 全站內容與設定</option>
            <option value="css">theme.css · 視覺變數</option>
          </select>
        </label>
        <label className="code-label" htmlFor="site-code">
          {file === "content" ? "content.json" : "theme.css"}
          {dirty ? " · 未套用" : ""}
        </label>
        <textarea
          id="site-code"
          aria-label="網站程式碼"
          className="code-input"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={file === "content" ? json : css}
          onChange={(e) => {
            (file === "content" ? setJson : setCss)(e.target.value);
            setDirty(true);
            setMessage("");
          }}
        />
        <div className="code-actions">
          <button className="panel-primary" onClick={commit} disabled={stale}>
            驗證並套用
          </button>
          <button
            className="panel-secondary"
            onClick={() => {
              if (
                !dirty ||
                window.confirm("捨棄尚未套用的代碼，載入目前草稿？")
              )
                refresh();
            }}
          >
            載入目前草稿
          </button>
          <button
            className="panel-secondary"
            onClick={() => {
              try {
                setJson(JSON.stringify(JSON.parse(json), null, 2));
                setMessage("JSON 已格式化。");
              } catch {
                setMessage("JSON 語法錯誤，無法格式化。");
              }
            }}
            disabled={file !== "content"}
          >
            格式化 JSON
          </button>
        </div>
        {stale && (
          <p className="studio-error" role="status">
            草稿已更新，請先載入目前草稿。
          </p>
        )}
        {message && (
          <p className="code-message" role="status">
            {message}
          </p>
        )}
        <p className="panel-help">
          此工作區編輯內容資料與型別化 CSS 變數；任意 JavaScript、HTML
          模板與外部 CSS 載入不在此執行。完整 React／Astro 原始碼可於 GitHub
          專案修改。
        </p>
      </div>
      {full && (
        <CodePreview
          content={candidate}
          page={page}
          api={api}
          base={base}
          assets={assets}
          error={previewError}
        />
      )}
    </div>
  );
}
