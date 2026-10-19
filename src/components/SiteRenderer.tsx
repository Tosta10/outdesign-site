import type { SiteContent } from "../../supabase/functions/_shared/schema.ts";
import { assetUrl } from "../lib/content.ts";
import { Icon } from "./Icon.tsx";

type Props = {
  content: SiteContent;
  api?: string;
  base?: string;
  editing?: boolean;
  selected?: string;
  privateAssets?: Record<string, string>;
};
export function SiteRenderer({
  content: c,
  api = "",
  base = "/",
  editing = false,
  selected = "",
  privateAssets = {},
}: Props) {
  const img = (v: string) => assetUrl(v, api, base, privateAssets);
  const edit = (key: string) => (editing ? { "data-edit": key } : {});
  const editClass = (key: string) =>
    editing ? ` editable ${selected === key ? "is-selected" : ""}` : "";
  const isExampleEmail = c.contact.email.endsWith("@example.com");
  return (
    <div className={`site theme-${c.settings.theme}`}>
      <a className="skip-link" href="#main">
        跳至主要內容
      </a>
      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label={`${c.settings.name} 首頁`}
        >
          <span className="brand-mark">
            o<span />
          </span>
          {c.settings.name}
          <span className="wordmark-sub">PERSONAL SPACE</span>
        </a>
        <nav className="desktop-nav" aria-label="主要導覽">
          <a href="#work">
            作品<span>{String(c.projects.length).padStart(2, "0")}</span>
          </a>
          <a href="#notes" hidden={!c.settings.showNotes}>
            筆記
          </a>
          <a href="#about">關於</a>
        </nav>
        <a className="contact-pill" href="#contact">
          <span className="status-dot" />
          一起聊聊
          <Icon name="diagonal" size={14} />
        </a>
        <button
          className="icon-button mobile-menu"
          aria-label="開啟選單"
          aria-expanded="false"
          data-menu-toggle
        >
          <Icon name="menu" />
        </button>
        <nav className="mobile-nav" aria-label="手機導覽" hidden>
          <a href="#work">作品</a>
          {c.settings.showNotes && <a href="#notes">筆記</a>}
          <a href="#about">關於</a>
          <a href="#contact">聯絡</a>
        </nav>
      </header>
      <main id="main">
        <section
          className={`hero section-shell${editClass("hero")}`}
          id="top"
          {...edit("hero")}
        >
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-cross">✳</span>
              {c.hero.eyebrow}
            </p>
            <h1>
              {c.hero.line1}
              <br />
              <span className="hero-second">
                {c.hero.line2}
                <span className="iridescent-dot" />
              </span>
            </h1>
            <p className="hero-description preserve-lines">
              {c.hero.description}
            </p>
            <div className="hero-actions">
              <a className="button button-white" href="#work">
                探索作品
                <Icon name="diagonal" size={17} />
              </a>
              <a className="text-link" href="#about">
                關於這個空間
                <Icon name="arrow" size={16} />
              </a>
            </div>
            <p className="hero-footnote">
              <span className="hairline" />
              DESIGN · DEVELOPMENT · EXPLORATION
            </p>
          </div>
          <figure className="hero-art">
            <div className="art-corner corner-tl" />
            <div className="art-corner corner-br" />
            {c.hero.image && (
              <img
                src={img(c.hero.image)}
                alt={c.hero.alt}
                width="780"
                height="820"
                fetchPriority="high"
                decoding="async"
              />
            )}
            <figcaption>
              <span>OBJECT STUDY — 001</span>
              <span>LIGHT, IN A QUIET SPACE.</span>
            </figcaption>
          </figure>
          <a className="scroll-cue" href="#work">
            <span>SCROLL TO EXPLORE</span>
            <span>↓</span>
          </a>
        </section>
        <section className="work-section section-shell" id="work">
          <div className="section-heading">
            <div>
              <p className="eyebrow section-number">01 / SELECTED WORK</p>
              <h2>
                一些作品，<span className="muted">一些探索。</span>
              </h2>
            </div>
            <p className="section-intro">
              從想法到實作，
              <br />
              讓每一個細節都有它的理由。
            </p>
          </div>
          <div className="work-toolbar">
            <div className="filters" role="group" aria-label="作品分類">
              {["全部", "設計", "開發", "實驗"].map((tag, i) => (
                <button
                  key={tag}
                  data-filter={tag}
                  aria-pressed={i === 0}
                  className={i === 0 ? "active" : ""}
                >
                  {tag}
                  {i === 0 && (
                    <span>{String(c.projects.length).padStart(2, "0")}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="tiny-label">A COLLECTION OF THINGS I MAKE</span>
          </div>
          <div className="work-grid">
            {c.projects.map((p, i) => (
              <article
                key={p.id}
                className={`work-card work-${p.tone} ${editing && selected === `project:${p.id}` ? "is-selected" : ""}`}
                data-category={p.category}
                data-edit={editing ? `project:${p.id}` : undefined}
              >
                <button
                  className="work-image-button"
                  data-open-dialog={`project-${p.id}`}
                  aria-label={`查看作品：${p.title}`}
                >
                  <div className="work-image">
                    {p.image && (
                      <img
                        src={img(p.image)}
                        alt={p.alt}
                        width="1200"
                        height="820"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <span className="work-index">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="work-arrow">
                    <Icon name="diagonal" />
                  </span>
                  {p.demo && <span className="demo-tag">概念示範</span>}
                </button>
                <div className="work-caption">
                  <div>
                    <h3>{p.title}</h3>
                    <p>
                      {p.category}
                      <span>／</span>
                      {p.year}
                    </p>
                  </div>
                  <span className="caption-index">↗</span>
                </div>
                <dialog id={`project-${p.id}`} className="detail-dialog">
                  <button
                    className="icon-button dialog-close"
                    data-close-dialog
                    aria-label="關閉作品"
                  >
                    <Icon name="close" />
                  </button>
                  <p className="eyebrow">
                    {p.category} / {p.year}
                    {p.demo ? " / 概念示範" : ""}
                  </p>
                  <h2>{p.title}</h2>
                  {p.image && (
                    <img
                      src={img(p.image)}
                      alt={p.alt}
                      width="1200"
                      height="820"
                      loading="lazy"
                    />
                  )}
                  <p className="preserve-lines">{p.description}</p>
                  {p.url && (
                    <a
                      href={p.url}
                      className="button button-white"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      前往作品
                      <Icon name="diagonal" size={17} />
                    </a>
                  )}
                </dialog>
              </article>
            ))}
          </div>
          {c.projects.length === 0 && (
            <p className="empty-state">作品正在整理中，敬請期待。</p>
          )}
        </section>
        {c.settings.showNotes && (
          <section className="notes-section section-shell" id="notes">
            <div className="section-heading">
              <div>
                <p className="eyebrow section-number">02 / NOTES & THOUGHTS</p>
                <h2>
                  想法的<span className="muted">切片。</span>
                </h2>
              </div>
              <span className="section-intro">寫下來，讓思考繼續發生。</span>
            </div>
            <div className="notes-list">
              {c.notes.map((n) => (
                <details
                  key={n.id}
                  className={`note-item ${editing && selected === `note:${n.id}` ? "is-selected" : ""}`}
                  data-edit={editing ? `note:${n.id}` : undefined}
                >
                  <summary>
                    <span className="note-date">{n.date}</span>
                    <h3>{n.title}</h3>
                    <span className="note-tag">{n.tag}</span>
                    <span className="note-plus">
                      <Icon name="plus" size={18} />
                    </span>
                  </summary>
                  <div className="note-body">
                    <p className="preserve-lines">{n.excerpt}</p>
                    {n.url && (
                      <a
                        className="text-link"
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        繼續閱讀
                        <Icon name="diagonal" size={16} />
                      </a>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
        <section
          className={`about-section section-shell${editClass("about")}`}
          id="about"
          {...edit("about")}
        >
          <div className="about-heading">
            <p className="eyebrow section-number">03 / A LITTLE ABOUT ME</p>
            <h2 className="preserve-lines">{c.about.title}</h2>
            <div className="tag-list">
              {c.about.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="about-copy">
            <p className="preserve-lines">{c.about.body}</p>
            {c.settings.showMusic && (
              <div
                className="music-widget"
                data-edit={editing ? "music" : undefined}
              >
                <button
                  className="music-play"
                  data-audio-toggle
                  aria-label="播放示範音樂"
                  aria-pressed="false"
                  disabled={!c.music.url}
                >
                  <span data-play-icon>
                    <Icon name="play" size={18} />
                  </span>
                  <span data-pause-icon hidden>
                    <Icon name="pause" size={18} />
                  </span>
                </button>
                <div>
                  <span className="tiny-label">ON MY FREQUENCY</span>
                  <p>{c.music.title}</p>
                  <span className="music-artist">{c.music.artist}</span>
                </div>
                <div className="sound-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                {c.music.url && (
                  <audio
                    data-site-audio
                    preload="none"
                    src={img(c.music.url)}
                  />
                )}
              </div>
            )}
            <p className="audio-feedback" data-audio-feedback role="status" />
          </div>
        </section>
        {c.attachments.length > 0 && (
          <section className="attachments section-shell">
            <p className="eyebrow">RESOURCES / 下載附件</p>
            {c.attachments.map((a) => (
              <a
                key={a.id}
                href={img(a.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="attachment-link"
              >
                <Icon name="file" />
                <span>{a.name}</span>
                <span>{a.label}</span>
                <Icon name="diagonal" size={16} />
              </a>
            ))}
          </section>
        )}
        <section
          className={`contact-section section-shell${editClass("contact")}`}
          id="contact"
          {...edit("contact")}
        >
          <div className="contact-top">
            <p className="eyebrow section-number">04 / LET'S MAKE SOMETHING</p>
            <span className="contact-spark">✳</span>
          </div>
          <div className="contact-main">
            <h2 className="preserve-lines">{c.contact.headline}</h2>
            <a
              className="contact-orbit"
              href={
                isExampleEmail ? "#contact-email" : `mailto:${c.contact.email}`
              }
              aria-label={isExampleEmail ? "查看示範聯絡資訊" : "寄信聯絡"}
            >
              <Icon name="diagonal" size={34} />
            </a>
          </div>
          <div className="contact-bottom">
            <a
              id="contact-email"
              className="email-link"
              href={isExampleEmail ? undefined : `mailto:${c.contact.email}`}
            >
              {c.contact.email}
            </a>
            {isExampleEmail && (
              <span className="tiny-label">示範信箱 · 請於作者模式修改</span>
            )}
            <div className="social-links">
              {c.contact.github && (
                <a
                  href={c.contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub ↗
                </a>
              )}
              {c.contact.instagram && (
                <a
                  href={c.contact.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram ↗
                </a>
              )}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer section-shell">
        <div>
          <a className="footer-brand" href="#top">
            {c.settings.name}
            <span className="iridescent-dot small" />
          </a>
          <p>MADE WITH INTENTION.</p>
        </div>
        <div className="footer-meta">
          <span>
            © {new Date().getUTCFullYear()} {c.settings.name}
          </span>
          <button data-studio-launch className="author-link">
            <Icon name="lock" size={12} />
            作者模式
          </button>
          <a href="#top">回到頂端 ↑</a>
        </div>
      </footer>
      <div className="site-toast" role="status" data-site-toast hidden />
    </div>
  );
}
