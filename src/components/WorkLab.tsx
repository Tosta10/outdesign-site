import { families, parts, createLabItems } from "../lib/work-lab/state";
import type { SiteContent } from "../../supabase/functions/_shared/schema";
export function WorkLab({
  projects,
  imageUrl,
}: {
  projects: SiteContent["projects"];
  imageUrl: (value: string) => string;
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
      data-mode="detail"
      data-theme="dark"
      aria-label="OutDesign 玻璃卡帶作品展示"
    >
      <header className="lab-header">
        <a href="#work" className="lab-wordmark">
          <span className="lab-symbol" aria-hidden="true">
            ◈
          </span>
          <span>
            OUTDESIGN<small>SELECTED WORK / GLASS ARCHIVE</small>
          </span>
        </a>
        <nav aria-label="研究室工具">
          <button data-lab-action="search" aria-label="搜尋作品">
            搜尋 <kbd>/</kbd>
          </button>
          <button data-lab-action="saved" aria-label="檢視收藏作品">
            收藏 <span data-lab-saved-count>00</span>
          </button>
          <button data-lab-action="settings" aria-label="開啟展示設定">
            設定 ↗
          </button>
          <button data-lab-action="fullscreen" aria-label="全螢幕作品展示">
            ⤢
          </button>
        </nav>
      </header>
      <div className="lab-intro">
        <p>IDEAS, TAKING SHAPE.</p>
        <h2>把作品，收藏進光裡。</h2>
        <span>一件作品，一枚玻璃卡帶。拖曳，從另一個角度觀看。</span>
      </div>
      <div className="lab-body">
        <div
          className="lab-stage"
          tabIndex={0}
          role="group"
          aria-label="三維物件工作區：方向鍵瀏覽，Enter 開啟，拖曳旋轉，滾輪縮放"
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
        <aside className="lab-detail" aria-label="作品資料">
          <p className="lab-micro">
            SELECTED WORK / <span data-lab-code>{first.code}</span>
          </p>
          <h3 data-lab-title>{first.title}</h3>
          <p className="lab-english" data-lab-english>
            {first.english}
          </p>
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
              </dl>
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
            <button data-lab-action="inspect">360° 卡帶檢視 ↗</button>
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
      <div className="lab-navigation">
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
        <div className="lab-selection">
          <button data-lab-action="previous" aria-label="上一件作品">
            ←
          </button>
          <span className="lab-number" data-lab-number>
            01
          </span>
          <span data-lab-total>
            / {String(projects.length).padStart(2, "0")}
          </span>
          <button data-lab-action="next" aria-label="下一件作品">
            →
          </button>
          <button data-lab-action="open">開啟卡帶 ↗</button>
        </div>
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
          <i />{" "}
          <span data-lab-status role="status" aria-live="polite">
            拖曳瀏覽陣列，或使用方向鍵與 Enter。
          </span>
        </span>
        <div>
          <button data-lab-action="replay">重播開場</button>
          <time data-lab-clock>00:00:00</time>
        </div>
      </footer>
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
          <h3 id="od-lab-search-title">作品索引</h3>
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
        <p data-lab-search-status role="status" />
        <div className="lab-search-results" data-lab-results />
      </dialog>
      <dialog
        className="lab-modal"
        data-lab-modal="settings"
        aria-labelledby="od-lab-settings-title"
      >
        <header>
          <h3 id="od-lab-settings-title">展示設定</h3>
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
          開啟 JavaScript 可探索三維物件；原創幾何預覽仍可閱讀。
        </p>
      </noscript>
    </section>
  );
}
