import { BootGraphic } from "./BootGraphic";
import { useEffect, useRef, type CSSProperties } from "react";
import { elementProps, presentationCopy } from "../lib/presentation";
import { resolveWorkLabConfig } from "../../supabase/functions/_shared/work-lab-config";
import { labCopyDefaults } from "../lib/work-lab/copy";
import { sendLabCommand } from "../lib/work-lab/bridge";
import {
  families,
  parts,
  createLabItems,
  motionLabels,
} from "../lib/work-lab/state";
import type { SiteContent } from "../../supabase/functions/_shared/schema";
export function WorkLab({
  content,
  editing = false,
  imageUrl,
  homeUrl = "/",
}: {
  content: SiteContent;
  editing?: boolean;
  imageUrl: (value: string) => string;
  homeUrl?: string;
}) {
  const projects = content.projects;
  const config = resolveWorkLabConfig(content.workLab);
  const configJSON = JSON.stringify(config);
  const sceneRoot = useRef<HTMLElement>(null);
  const layer = (key: string) => elementProps(content, `lab-${key}`, editing);
  const copy = (key: string) => <span className="lab-copy" {...elementProps(content, `copy-lab.${key}`, editing)} data-edit={editing ? `copy:lab.${key}` : undefined} data-copy-key={`lab.${key}`}>{presentationCopy(content, `lab.${key}`, labCopyDefaults[`lab.${key}`])}</span>;
  const items = createLabItems(
    projects.map((p) => ({ ...p, image: p.image ? imageUrl(p.image) : "" })),
  );
  const first = items[0];
  const itemsJSON = JSON.stringify(items);
  useEffect(() => {
    if (!editing || !sceneRoot.current || sceneRoot.current.closest(".logic-inventory")) return;
    const element = sceneRoot.current;
    let disposed = false, cleanup: (() => void) | undefined;
    void import("../lib/work-lab/index").then(async ({ initWorkLab }) => {
      if (disposed) return;
      const dispose = await initWorkLab(element, { authoring: true });
      if (disposed) dispose(); else cleanup = dispose;
    });
    return () => { disposed = true; cleanup?.(); };
  }, [editing, itemsJSON]);
  useEffect(() => {
    if (editing && sceneRoot.current) sendLabCommand(sceneRoot.current, { type: "config", value: resolveWorkLabConfig(JSON.parse(configJSON)) });
  }, [editing, configJSON]);
  return (
    <section
      ref={sceneRoot}
      className="work-lab"
      data-lab-config={configJSON}
      data-lab-authoring={editing || undefined}
      style={{ "--lab-cover-scale": config.parameters.coverScale, "--lab-cassette-color": config.options.theme === "dark" ? config.palette.darkShell : config.palette.shell } as CSSProperties}
      data-work-lab
      data-lab-items={JSON.stringify(items)}
      data-mode="browse"
      data-theme={config.options.theme}
      aria-label="OutDesign 玻璃卡帶作品展示"
    >
      <header className="lab-header" {...layer("header")}>
        <a href={homeUrl} data-page-target="home" className="lab-wordmark" {...layer("brand")}>
          <span className="lab-symbol" aria-hidden="true">
            ◈
          </span>
          <span>
            {content.settings.name.toUpperCase()}<small>{copy("brand.sub")}</small>
            <strong>{copy("brand.os")}</strong>
          </span>
        </a>
        <nav aria-label="作品展示工具">
          <button {...layer("action-search-1")} data-lab-action="search" aria-label="搜尋作品">
            <span className="lab-search-glyph" aria-hidden="true">
              ⌕
            </span>{" "}
            {copy("search")}  <kbd>/</kbd>
          </button>
          <button {...layer("action-saved-1")} data-lab-action="saved" aria-label="檢視收藏作品">
            {copy("saved")}  <span data-lab-saved-count>00</span>
          </button>
          <button {...layer("menu")} className="navigation-trigger" data-menu-toggle aria-controls="site-navigation" aria-expanded="false" aria-label="開啟選單"><span aria-hidden="true">☰</span><small>{copy("menu")}</small></button>
          <button {...layer("action-fullscreen-1")} data-lab-action="fullscreen" aria-label="全螢幕作品展示">
            ⤢
          </button>
        </nav>
      </header>
      <div className="lab-body" {...layer("body")}>
        <div
          className="lab-stage" {...layer("scene")}
          tabIndex={0}
          role="group"
          aria-label="三維作品陣列：上下鍵與滾輪切換作品，左右鍵切換分類，Enter 開啟；檢視時拖曳旋轉、雙指縮放"
        >
          <div className="lab-poster" aria-hidden="true">
            <div className="lab-illustrated-case">
              <div className="lab-poster-label">OUTDESIGN / {first.code}</div>
              {first.image ? (
                <img src={first.image} alt="" />
              ) : (
                <div className="lab-poster-placeholder">
                  <span>＋</span>
                  <small>YOUR NEXT WORK</small>
                </div>
              )}
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <canvas data-lab-canvas aria-hidden="true" />
          <div className="lab-reticle" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="lab-scan" aria-hidden="true" />
          <div className="lab-stage-caption" {...layer("scene-caption")}>
            <span data-lab-render-status>準備互動場景</span>
            <span>{copy("surface")}</span>
          </div>
          <button className="lab-stage-back" {...layer("back")} data-lab-action="back">
            {copy("archive")}  <kbd>Esc</kbd>
          </button>
          <div className="lab-object-caption" {...layer("object-caption")}>
            <strong data-lab-object-code>{first.code}</strong>
            <small>{copy("creative")}</small>
            <p>{copy("drag")}</p>
            <button {...layer("action-inspect-1")} data-lab-action="inspect">{copy("inspect")}</button>
          </div>
          <div className="lab-view-controls" {...layer("view-controls")}>
            <button {...layer("action-glass-1")} data-lab-action="glass" aria-pressed="false">
              {copy("glass")}
            </button>
            <button {...layer("action-explode-1")} data-lab-action="explode" aria-pressed="false">
              {copy("explode")}
            </button>
            <button {...layer("action-reset-1")} data-lab-action="reset">{copy("reset")}</button>
          </div>
        </div>
        <aside className="lab-browse-info" {...layer("browse-info")} aria-label="目前選取的作品">
          <p className="lab-micro">
            {copy("creative")} /{" "}
            <span data-lab-browse-category>{first.category}</span>
          </p>
          <h1>
            <button {...layer("action-open-1")} data-lab-action="open" aria-label="讀取目前作品">
              {copy("file")}  <span data-lab-browse-code>{first.code}</span>
              <i aria-hidden="true">↗</i>
            </button>
          </h1>
          <div className="lab-callout-rule">
            <i />
          </div>
          <div className="lab-browse-summary">
            <h2 data-lab-browse-title>{first.title}</h2>
            <small>{copy("reference")}</small>
          </div>
          <button {...layer("action-open-2")} data-lab-action="open" aria-label="開啟作品">
            {copy("access")}  <span>→</span>
          </button>
        </aside>
        <aside className="lab-detail" {...layer("detail")} aria-label="作品資料" hidden>
          <p className="lab-micro">
            {copy("selected")}  <span data-lab-code>{first.code}</span>
          </p>
          <h3 data-lab-title>{first.title}</h3>
          <p className="lab-english" data-lab-english>
            {first.english}
          </p>
          <dl>
            <div>
              <dt>{copy("year")}</dt>
              <dd data-lab-year>{first.year}</dd>
            </div>
            <div>
              <dt>{copy("category")}</dt>
              <dd data-lab-family>
                {first.empty ? "待新增" : families[first.family]}
              </dd>
            </div>
            <div>
              <dt>{copy("format")}</dt>
              <dd>{copy("flat")}</dd>
            </div>
            <div>
              <dt>{copy("status")}</dt>
              <dd>{copy("readable")}</dd>
            </div>
          </dl>
          <div className="lab-document" {...layer("document")} data-lab-document>
            <div className="lab-tabs" role="tablist" aria-label="研究內容">
              {["作品介紹", "卡帶結構", "操作紀錄"].map((label, i) => (
                <button {...layer(`tab-${i}`)}
                  key={label}
                  role="tab"
                  aria-selected={i === 0}
                  aria-controls={`od-lab-tab-${i}`}
                  id={`od-lab-tab-button-${i}`}
                  data-lab-tab={i}
                >
                  {copy(`tab.${i}`)}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="od-lab-tab-0"
              aria-labelledby="od-lab-tab-button-0"
              data-lab-tab-panel="0"
            >
              <p data-lab-description>{first.description}</p>
            </div>
            <div
              role="tabpanel"
              id="od-lab-tab-1"
              aria-labelledby="od-lab-tab-button-1"
              data-lab-tab-panel="1"
              hidden
            >
              <ol className="lab-parts">
                {parts.map((part, i) => (
                  <li key={part}>
                    <button {...layer(`part-${i}`)} data-lab-part={i}>
                      <span>0{i + 1}</span>
                      {part}
                      <i>↗</i>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div
              role="tabpanel"
              id="od-lab-tab-2"
              aria-labelledby="od-lab-tab-button-2"
              data-lab-tab-panel="2"
              hidden
            >
              <ol className="lab-log" data-lab-log>
                <li>物件已載入，等待第一次探索。</li>
              </ol>
            </div>
          </div>
          <div className="lab-detail-actions">
            <button {...layer("action-save-1")} data-lab-action="save" aria-pressed="false">
              {copy("save")}
            </button>
            <button {...layer("action-export-1")} data-lab-action="export">{copy("export")}</button>
            <a
              className="lab-project-link"
              data-lab-project-link
              href={first.url || undefined}
              hidden={!first.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy("visit")}
            </a>
          </div>
        </aside>
      </div>
      <div className="lab-counter" {...layer("counter")}>
        <span>{copy("counter")}</span>
        <div>
          <span className="lab-number" data-lab-number>
            01
          </span>
          <i>/</i>
          <span data-lab-total>
            / {String(projects.length).padStart(2, "0")}
          </span>
        </div>
      </div>
      <div className="lab-navigation" {...layer("navigation")} aria-label="作品導覽">
        <button {...layer("action-previous-1")} data-lab-action="previous" aria-label="上一件作品">
          ↑
        </button>
        <div className="lab-ticks" data-lab-ticks />
        <button {...layer("action-next-1")} data-lab-action="next" aria-label="下一件作品">
          ↓
        </button>
      </div>
      <div className="lab-archive-hint" {...layer("hint")}>
        {copy("keyboard")}
      </div>
      <div className="lab-hover-label" data-lab-hover hidden />
      <div className="lab-powered" {...layer("powered")}>
        POWERED BY <b>OUTDESIGN</b>
        <i />
      </div>
      <div className="lab-column-control" {...layer("columns")} aria-label="分類導覽">
        <button {...layer("action-previous-column-1")} data-lab-action="previous-column" aria-label="上一個分類">
          ←
        </button>
        <div>
          <small data-lab-column-number>COLUMN 01 / 01</small>
          <span data-lab-column-label>{first.category}</span>
        </div>
        <button {...layer("action-next-column-1")} data-lab-action="next-column" aria-label="下一個分類">
          →
        </button>
      </div>
      {projects.length > 0 && (
        <div className="lab-work-switcher" aria-label="作品卡帶清單">
          {items.map((item) => (
            <button
              key={item.key}
              data-lab-work-index={item.id}
              data-element-key={`project-${item.key}`}
              data-edit={`project:${item.key}`}
              aria-label={`選擇作品：${item.title}`}
            >
              <small>{item.code}</small>
              <span>{item.title}</span>
            </button>
          ))}
        </div>
      )}
      <footer className="lab-footer" {...layer("footer")}>
        <span>
          <i /> ARCHIVE ONLINE{" "}
          <span
            data-lab-status
            className="lab-live-message"
            role="status"
            aria-live="polite"
          >
            拖曳瀏覽陣列，或使用方向鍵與 Enter。
          </span>
        </span>
        <div>
          <button data-studio-launch className="author-link">
            {copy("author")}
          </button>
          <time data-lab-clock>00:00:00</time>
          <button {...layer("action-replay-1")} data-lab-action="replay" aria-label="重播開場">
            {copy("replay")}
          </button>
        </div>
      </footer>
      <div className="lab-inspection-ui" {...layer("inspection")} hidden data-lab-inspection>
        <header>
          <button {...layer("action-close-inspect-1")} data-lab-action="close-inspect" aria-label="返回作品資料">
            {copy("return")}  <kbd>ESC</kbd>
          </button>
          <div>
            <small>{copy("object")}</small>
            <h2>{copy("cassette")}</h2>
            <p data-lab-viewer-code>{first.code}</p>
          </div>
          <strong>360°</strong>
        </header>
        <div className="lab-viewer-surface" role="group" aria-label="玻璃模式">
          <button {...layer("action-clear-1")} data-lab-action="clear" aria-pressed="true">
            {copy("clear")}
          </button>
          <button {...layer("action-frosted-1")} data-lab-action="frosted" aria-pressed="false">
            {copy("frosted")}
          </button>
        </div>
        <aside aria-label="卡帶裝配結構">
          <small>{copy("assembly")}</small>
          {parts.map((part, i) => (
            <p key={part}>
              <span>0{i + 1}</span>
              <strong>{part}</strong>
            </p>
          ))}
        </aside>
        <footer>
          <span>{copy("gesture")}</span>
          <button {...layer("action-assemble-1")} data-lab-action="assemble">{copy("assemble")}</button>
        </footer>
      </div>
      <div className="lab-boot" hidden>
        <BootGraphic />
      </div>
      <dialog
        className="lab-modal"
        data-lab-modal="search"
        aria-labelledby="od-lab-search-title"
      >
        <header>
          <h3 id="od-lab-search-title">ARCHIVE INDEX / 作品索引</h3>
          <button data-lab-close aria-label="關閉作品索引">
            ×
          </button>
        </header>
        <label>
          搜尋作品
          <input
            data-lab-search
            type="search"
            placeholder="輸入編號、作品名稱或分類"
            autoComplete="off"
          />
        </label>
        <div className="lab-categories" role="group" aria-label="作品分類">
          {families.map((family, i) => (
            <button
              key={family}
              data-lab-family-index={i}
              aria-pressed={i === 0}
            >
              <span>0{i + 1}</span>
              {family}
            </button>
          ))}
        </div>
        <p data-lab-search-status role="status" />
        <div className="lab-result-heading">
          <span>FILE / 作品</span>
          <span>CATEGORY / 分類</span>
          <span>ACCESS</span>
        </div>
        <div className="lab-search-results" data-lab-results />
      </dialog>
      <dialog
        className="lab-modal experience-settings"
        data-lab-modal="settings"
        aria-labelledby="od-lab-settings-title"
      >
        <header>
          <div><span className="settings-eyebrow">ARCHIVE PREFERENCES</span><h3 id="od-lab-settings-title">沉浸，依你所好</h3></div>
          <button data-lab-close aria-label="關閉展示設定">
            ×
          </button>
        </header>
        <p className="settings-intro">為作品選一種光線，為探索留一點聲音。</p>
        <h4 className="settings-section">01 / 畫面與動態</h4>
        <label>
          全站配色
          <select data-lab-setting="theme">
            <option value="dark">深色</option>
            <option value="light">淺色</option>
          </select>
        </label>
        <label>
          渲染品質
          <select data-lab-setting="quality">
            <option value="low">省電</option>
            <option value="medium">標準</option>
            <option value="high">精細：環境遮蔽與景深</option>
          </select>
        </label>
        <p data-lab-quality-status role="status" />
        <label>
          動態模式
          <select data-lab-setting="motionPreset">
            <option value="system">依系統設定</option>
            <option value="full">完整動態</option>
            <option value="reduced">減少動態</option>
          </select>
        </label>
        <details className="lab-motion-options">
          <summary>動態效果精細設定</summary>
          {Object.entries(motionLabels).map(([key, label]) => (
            <label className="lab-check" key={key}>
              <input type="checkbox" data-lab-effect={key} />
              {label}
            </label>
          ))}
        </details>
        <label className="lab-check">
          <input data-lab-setting="motion" type="checkbox" />
          動態效果
        </label>
        <h4 className="settings-section">02 / 聲音與氛圍</h4>
        <label className="lab-check">
          <input data-lab-setting="sound" type="checkbox" />
          互動音效
        </label>
        <label className="lab-check">
          <input data-lab-setting="ambient" type="checkbox" />
          合成環境音
        </label>
        <label className="volume-control">
          <span className="volume-heading">音場強度 <output data-lab-volume-value>10×</output></span>
          <input
            data-lab-setting="volume"
            aria-label="音場強度"
            type="range"
            min="0"
            max="100"
            step="1"
            defaultValue="50"
          />
          <span className="volume-scale" aria-hidden="true"><span>輕柔</span><span>飽滿</span></span>
        </label>
        <div className="volume-presets" role="group" aria-label="音場強度預設">
          <button data-lab-volume-preset="1.5" aria-pressed="false">5× <span>輕柔</span></button>
          <button data-lab-volume-preset="3" aria-pressed="true">10× <span>均衡</span></button>
          <button data-lab-volume-preset="6" aria-pressed="false">20× <span>飽滿</span></button>
        </div>
        <p>
          配色會同步至全站所有頁面。音訊在啟用後由瀏覽器即時合成；不載入音檔。動態效果遵循系統的減少動態設定。
        </p>
      </dialog>
      <noscript>
        <p className="lab-no-script">
          開啟 JavaScript 可探索三維作品；封面與作品資料仍可閱讀。
        </p>
      </noscript>
    </section>
  );
}
