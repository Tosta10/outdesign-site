import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { elementProps } from "../lib/presentation";
import { assetUrl } from "../lib/content";
import { EditableText } from "./EditableText";
import { Icon } from "./Icon";
import { WorkLab } from "./WorkLab";
import { SourceValue } from "./SourceValue";
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
  const value = (path: string) => (
    <SourceValue content={c} path={path} editing={editing} />
  );
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
          data-edit={editing ? "projects" : undefined}
          id="work"
        >
          <WorkLab content={c} editing={editing} imageUrl={img} />
          {c.projects.length === 0 && <div className="lab-portfolio-empty"><span>目前尚無作品。</span><span>可在作者模式新增作品名稱、介紹與封面。</span></div>}
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
                  <details
                    className={`note-item ${editing && selected === `note:${n.id}` ? "is-selected" : ""}`}
                    data-edit={editing ? `note:${n.id}` : undefined}
                  >
                    <summary>
                      <span className="note-date">
                        {value(`notes.${n.id}.date`)}
                      </span>
                      <h3>{value(`notes.${n.id}.title`)}</h3>
                      <span className="note-tag">
                        {value(`notes.${n.id}.tag`)}
                      </span>
                      <span className="note-plus">
                        <Icon name="plus" size={18} />
                      </span>
                    </summary>
                    <div className="note-body">
                      <p className="preserve-lines">
                        {value(`notes.${n.id}.excerpt`)}
                      </p>
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
          <div className="about-heading">
            <p className="eyebrow section-number">
              {text("about.eyebrow", "03 / A LITTLE ABOUT ME")}
            </p>
            <h2 className="preserve-lines">{value("about.title")}</h2>
            <div className="tag-list">
              {c.about.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="about-copy">
            <p className="preserve-lines">{value("about.body")}</p>
            {c.settings.showMusic && (
              <div
                className="music-widget"
                {...elementProps(c, "music", editing)}
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
                  <p>{value("music.title")}</p>
                  <span className="music-artist">{value("music.artist")}</span>
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
                {...elementProps(c, `attachment-${a.id}`, editing)}
              >
                <Icon name="file" />
                <span>{value(`attachments.${a.id}.name`)}</span>
                <span>{value(`attachments.${a.id}.label`)}</span>
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
          <div className="contact-top">
            <p className="eyebrow section-number">
              {text("contact.eyebrow", "04 / LET'S MAKE SOMETHING")}
            </p>
          </div>
          <div className="contact-main">
            <h2 className="preserve-lines">{value("contact.headline")}</h2>
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
              {value("contact.email")}
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
