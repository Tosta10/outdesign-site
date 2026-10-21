import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { elementProps } from "../lib/presentation";
import { assetUrl } from "../lib/content";
import { EditableText } from "./EditableText";
import { Icon } from "./Icon";
import { CanvasHandle } from "./CanvasHandle";
export type SectionKey = "work" | "notes" | "about" | "attachments" | "contact";
export const defaultSections: SectionKey[] = [
  "work",
  "notes",
  "about",
  "attachments",
  "contact",
];
export type SectionProps = {
  content: SiteContent;
  api?: string;
  base?: string;
  editing?: boolean;
  selected?: string;
  privateAssets?: Record<string, string>;
};
export function ContentSection({
  section,
  content: c,
  api = "",
  base = "/",
  editing = false,
  selected = "",
  privateAssets = {},
}: SectionProps & { section: SectionKey }) {
  const text = (id: string, fallback?: string) => (
    <EditableText
      content={c}
      id={id}
      editing={editing}
      selected={selected}
      fallback={fallback}
    />
  );
  const img = (v: string) => assetUrl(v, api, base, privateAssets);
  const edit = (key: string) => (editing ? { "data-edit": key } : {});
  const editClass = (key: string) =>
    editing ? ` editable ${selected === key ? "is-selected" : ""}` : "";
  const isExampleEmail = c.contact.email.endsWith("@example.com");
  const sections = {
    work: (
      <>
        <section
          className="work-section section-shell"
          data-layout="section:work"
          {...elementProps(c, "work", editing)}
          id="work"
        >
          <CanvasHandle id="section:work" label="作品" editing={editing} />
          <div className="section-heading">
            <div>
              <p className="eyebrow section-number">
                {text("work.eyebrow", "01 / SELECTED WORK")}
              </p>
              <h2>
                {text("work.heading.first")}
                <span className="muted">{text("work.heading.second")}</span>
              </h2>
            </div>
            <p className="section-intro">{text("work.description")}</p>
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
                  {text(`filter.${i}`, tag)}
                  {i === 0 && (
                    <span>{String(c.projects.length).padStart(2, "0")}</span>
                  )}
                </button>
              ))}
            </div>
            <span className="tiny-label">{text("work.collection")}</span>
          </div>
          <div className="work-grid">
            {c.projects.map((p, i) => (
              <article
                key={p.id}
                className={`work-card work-${p.tone} ${editing && selected === `project:${p.id}` ? "is-selected" : ""}`}
                data-layout={`project:${p.id}`}
                {...elementProps(c, `project-${p.id}`, editing)}
                data-category={p.category}
                data-edit={editing ? `project:${p.id}` : undefined}
              >
                <CanvasHandle
                  id={`project:${p.id}`}
                  label={p.title}
                  editing={editing}
                />
                <button
                  className="work-image-button"
                  data-optical-card
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
      </>
    ),
    notes: (
      <>
        {c.settings.showNotes && (
          <section
            className="notes-section section-shell"
            data-layout="section:notes"
            {...elementProps(c, "notes", editing)}
            id="notes"
          >
            <CanvasHandle id="section:notes" label="筆記" editing={editing} />
            <div className="section-heading">
              <div>
                <p className="eyebrow section-number">
                  {text("notes.eyebrow", "02 / NOTES & THOUGHTS")}
                </p>
                <h2>
                  {text("notes.heading.first")}
                  <span className="muted">{text("notes.heading.second")}</span>
                </h2>
              </div>
              <span className="section-intro">{text("notes.description")}</span>
            </div>
            <div className="notes-list">
              {c.notes.map((n) => (
                <div
                  className="note-wrap"
                  key={n.id}
                  data-layout={`note:${n.id}`}
                  {...elementProps(c, `note-${n.id}`, editing)}
                >
                  <CanvasHandle
                    id={`note:${n.id}`}
                    label={n.title}
                    editing={editing}
                  />
                  <details
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
                </div>
              ))}
            </div>
          </section>
        )}
      </>
    ),
    about: (
      <>
        <section
          className={`about-section section-shell${editClass("about")}`}
          data-layout="section:about"
          {...elementProps(c, "about", editing)}
          id="about"
          {...edit("about")}
        >
          <CanvasHandle id="section:about" label="關於" editing={editing} />
          <div className="about-heading">
            <p className="eyebrow section-number">
              {text("about.eyebrow", "03 / A LITTLE ABOUT ME")}
            </p>
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
                  <span className="tiny-label">
                    {text("music.eyebrow", "ON MY FREQUENCY")}
                  </span>
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
      </>
    ),
    attachments: (
      <>
        {c.attachments.length > 0 && (
          <section
            className="attachments section-shell"
            data-layout="section:attachments"
            {...elementProps(c, "attachments", editing)}
            data-edit={editing ? "attachments" : undefined}
          >
            <CanvasHandle
              id="section:attachments"
              label="附件"
              editing={editing}
            />
            <p className="eyebrow">
              {text("resources.eyebrow", "RESOURCES / 下載附件")}
            </p>
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
      </>
    ),
    contact: (
      <>
        <section
          className={`contact-section section-shell${editClass("contact")}`}
          data-layout="section:contact"
          {...elementProps(c, "contact", editing)}
          id="contact"
          {...edit("contact")}
        >
          <CanvasHandle id="section:contact" label="聯絡" editing={editing} />
          <div className="contact-top">
            <p className="eyebrow section-number">
              {text("contact.eyebrow", "04 / LET'S MAKE SOMETHING")}
            </p>
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
                  {text("contact.github", "GitHub ↗")}
                </a>
              )}
              {c.contact.instagram && (
                <a
                  href={c.contact.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text("contact.instagram", "Instagram ↗")}
                </a>
              )}
            </div>
          </div>
        </section>
      </>
    ),
  };
  return sections[section];
}
