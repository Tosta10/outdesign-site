import {
  families,
  parts,
  createLabItems,
  motionLabels,
} from "../lib/work-lab/state";
import type { SiteContent } from "../../supabase/functions/_shared/schema";
export function WorkLab({
  projects,
  imageUrl,
  homeUrl = "/",
}: {
  projects: SiteContent["projects"];
  imageUrl: (value: string) => string;
  homeUrl?: string;
}) {
  const items = createLabItems(
    projects.map((p) => ({ ...p, image: p.image ? imageUrl(p.image) : "" })),
  );
  const first = items[0];
  return (
    <section
      className="work-lab"
      data-work-lab
      data-lab-items={JSON.stringify(items)}
      data-mode="browse"
      data-theme="light"
      aria-label="OutDesign 玻璃卡帶作品展示"
    >
      <header className="lab-header">
        <a href={homeUrl} data-page-target="home" className="lab-wordmark">
          <span className="lab-symbol" aria-hidden="true">
            ◈
          </span>
          <span>
            OUTDESIGN<small>CREATIVE INFORMATION</small>
            <strong>ARCHIVE OS</strong>
          </span>
        </a>
        <nav aria-label="作品展示工具">
          <button data-lab-action="search" aria-label="搜尋作品">
            <span className="lab-search-glyph" aria-hidden="true">
              ⌕
            </span>{" "}
            ARCHIVE INDEX <kbd>/</kbd>
          </button>
          <button data-lab-action="saved" aria-label="檢視收藏作品">
            ＋ SAVED <span data-lab-saved-count>00</span>
          </button>
          <button data-lab-action="settings" aria-label="開啟展示設定">
            <span className="lab-settings-glyph" aria-hidden="true">
              ◷
            </span>
            <small>設定</small>
          </button>
          <button data-lab-action="fullscreen" aria-label="全螢幕作品展示">
            ⤢
          </button>
        </nav>
      </header>
      <div className="lab-body">
        <div
          className="lab-stage"
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
          <div className="lab-stage-caption">
            <span data-lab-render-status>準備互動場景</span>
            <span>FLAT IMAGE / OPTICAL GLASS</span>
          </div>
          <button className="lab-stage-back" data-lab-action="back">
            ← 作品陣列 <kbd>Esc</kbd>
          </button>
          <div className="lab-object-caption">
            <strong data-lab-object-code>{first.code}</strong>
            <small>CREATIVE ARCHIVE</small>
            <p>DRAG TO INSPECT　↔</p>
            <button data-lab-action="inspect">360° 卡帶檢視 ↗</button>
          </div>
          <div className="lab-view-controls">
            <button data-lab-action="glass" aria-pressed="false">
              磨砂玻璃
            </button>
            <button data-lab-action="explode" aria-pressed="false">
              拆解構件 ＋
            </button>
            <button data-lab-action="reset">重設視角 ↗</button>
          </div>
        </div>
        <aside className="lab-browse-info" aria-label="目前選取的作品">
          <p className="lab-micro">
            CREATIVE ARCHIVE /{" "}
            <span data-lab-browse-category>{first.category}</span>
          </p>
          <h1>
            <button data-lab-action="open" aria-label="讀取目前作品">
              FILE NUMBER: <span data-lab-browse-code>{first.code}</span>
              <i aria-hidden="true">↗</i>
            </button>
          </h1>
          <div className="lab-callout-rule">
            <i />
          </div>
          <div className="lab-browse-summary">
            <h2 data-lab-browse-title>{first.title}</h2>
            <small>REFERENCE AREA</small>
          </div>
          <button data-lab-action="open" aria-label="開啟作品">
            ACCESS FILE <span>→</span>
          </button>
        </aside>
        <aside className="lab-detail" aria-label="作品資料" hidden>
          <p className="lab-micro">
            SELECTED WORK / <span data-lab-code>{first.code}</span>
          </p>
          <h3 data-lab-title>{first.title}</h3>
          <p className="lab-english" data-lab-english>
            {first.english}
          </p>
          <dl>
            <div>
              <dt>作品年份</dt>
              <dd data-lab-year>{first.year}</dd>
            </div>
            <div>
              <dt>作品類別</dt>
              <dd data-lab-family>
                {first.empty ? "待新增" : families[first.family]}
              </dd>
            </div>
            <div>
              <dt>展示方式</dt>
              <dd>平面封面 / 玻璃卡帶</dd>
            </div>
            <div>
              <dt>作品狀態</dt>
              <dd>可讀取</dd>
            </div>
          </dl>
          <div className="lab-document" data-lab-document>
            <div className="lab-tabs" role="tablist" aria-label="研究內容">
              {["作品介紹", "卡帶結構", "操作紀錄"].map((label, i) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={i === 0}
                  aria-controls={`od-lab-tab-${i}`}
                  id={`od-lab-tab-button-${i}`}
                  data-lab-tab={i}
                >
                  {label}
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
                    <button data-lab-part={i}>
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
            <button data-lab-action="save" aria-pressed="false">
              收藏作品 ＋
            </button>
            <button data-lab-action="export">匯出作品資料 ↓</button>
            <a
              className="lab-project-link"
              data-lab-project-link
              href={first.url || undefined}
              hidden={!first.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              前往作品 ↗
            </a>
          </div>
        </aside>
      </div>
      <div className="lab-counter">
        <span>ARCHIVE / SELECT</span>
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
      <div className="lab-navigation" aria-label="作品導覽">
        <button data-lab-action="previous" aria-label="上一件作品">
          ↑
        </button>
        <div className="lab-ticks" data-lab-ticks />
        <button data-lab-action="next" aria-label="下一件作品">
          ↓
        </button>
      </div>
      <div className="lab-archive-hint">
        ← → 切換分類　 /　 ↑ ↓ 瀏覽作品　 /　 ENTER 讀取
      </div>
      <div className="lab-hover-label" data-lab-hover hidden />
      <div className="lab-powered">
        POWERED BY <b>OUTDESIGN</b>
        <i />
      </div>
      <div className="lab-column-control" aria-label="分類導覽">
        <button data-lab-action="previous-column" aria-label="上一個分類">
          ←
        </button>
        <div>
          <small data-lab-column-number>COLUMN 01 / 01</small>
          <span data-lab-column-label>{first.category}</span>
        </div>
        <button data-lab-action="next-column" aria-label="下一個分類">
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
      <footer className="lab-footer">
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
          <button
            data-menu-toggle
            aria-controls="site-navigation"
            aria-expanded="false"
            aria-label="開啟選單"
          >
            選單 ↗
          </button>
          <button data-studio-launch className="author-link">
            作者模式
          </button>
          <time data-lab-clock>00:00:00</time>
          <button data-lab-action="replay" aria-label="重播開場">
            REINITIALIZE ↗
          </button>
        </div>
      </footer>
      <div className="lab-inspection-ui" hidden data-lab-inspection>
        <header>
          <button data-lab-action="close-inspect" aria-label="返回作品資料">
            ← 返回作品 <kbd>ESC</kbd>
          </button>
          <div>
            <small>OUTDESIGN / OBJECT STUDY</small>
            <h2>玻璃卡帶</h2>
            <p data-lab-viewer-code>{first.code}</p>
          </div>
          <strong>360°</strong>
        </header>
        <div className="lab-viewer-surface" role="group" aria-label="玻璃模式">
          <button data-lab-action="clear" aria-pressed="true">
            清晰
          </button>
          <button data-lab-action="frosted" aria-pressed="false">
            磨砂
          </button>
        </div>
        <aside aria-label="卡帶裝配結構">
          <small>ASSEMBLY / 裝配結構</small>
          {parts.map((part, i) => (
            <p key={part}>
              <span>0{i + 1}</span>
              <strong>{part}</strong>
            </p>
          ))}
        </aside>
        <footer>
          <span>拖曳旋轉　 /　 方向鍵平移　 /　 滾輪或雙指縮放</span>
          <button data-lab-action="assemble">− 一鍵重組</button>
        </footer>
      </div>
      <div className="lab-boot" hidden>
        <button data-lab-action="skip">略過開場 ↗</button>
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <path d="M80 12 148 80 80 148 12 80Z" />
          <path d="M80 40 120 80 80 120 40 80Z" />
          <circle cx="80" cy="80" r="54" />
        </svg>
        <span data-lab-boot-text>INITIALIZING OBJECT SPACE</span>
        <div>
          <i />
        </div>
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
        className="lab-modal"
        data-lab-modal="settings"
        aria-labelledby="od-lab-settings-title"
      >
        <header>
          <h3 id="od-lab-settings-title">SYSTEM PREFERENCES / 展示設定</h3>
          <button data-lab-close aria-label="關閉展示設定">
            ×
          </button>
        </header>
        <label>
          明暗配色
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
        <label className="lab-check">
          <input data-lab-setting="sound" type="checkbox" />
          互動音效
        </label>
        <label className="lab-check">
          <input data-lab-setting="ambient" type="checkbox" />
          合成環境音
        </label>
        <label>
          音量
          <input
            data-lab-setting="volume"
            type="range"
            min="0"
            max="0.3"
            step="0.01"
          />
        </label>
        <p>
          音訊在啟用後由瀏覽器即時合成；不載入音檔。動態效果遵循系統的減少動態設定。
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
