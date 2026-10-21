import type { CSSProperties } from "react";
import {
  defaultDesign,
  defaultInteractions,
} from "../../supabase/functions/_shared/schema";
import { elementProps } from "../lib/presentation";
import { assetUrl } from "../lib/content";
import { CanvasPanels } from "./CanvasPanels";
import { Icon } from "./Icon";
import { EditableText } from "./EditableText";
import {
  ContentSection,
  defaultSections,
  type SectionProps,
  type SectionKey,
} from "./ContentSection";

export type SitePage = "home" | "work" | "journal" | "about" | "resources";
export const pageNames: Record<SitePage, string> = {
  home: "首頁",
  work: "作品",
  journal: "筆記",
  about: "關於",
  resources: "資源",
};
export function SiteRenderer({
  content: c,
  api = "",
  base = "/",
  editing = false,
  selected = "",
  privateAssets = {},
  page = "home",
}: SectionProps & { page?: SitePage }) {
  const url = (route = "") =>
    `${base.replace(/\/$/, "")}/${route}${route ? "/" : ""}`;
  const img = (value: string) => assetUrl(value, api, base, privateAssets);
  const text = (id: string, fallback?: string) => (
    <EditableText
      content={c}
      id={id}
      editing={editing}
      selected={selected}
      fallback={fallback}
    />
  );
  const first = c.projects[0];
  const scenic =
    c.hero.image === "/assets/prism.svg"
      ? "/assets/lunar-landscape.webp"
      : c.hero.image;
  const allowed: Record<SitePage, SectionKey[]> = {
    home: [],
    work: ["work"],
    journal: ["notes"],
    about: ["about", "contact"],
    resources: ["attachments"],
  };
  const sections = (c.layout?.sections || defaultSections).filter((key) =>
    allowed[page].includes(key),
  );
  const pageLayout = c.workspace?.pages?.[page];
  const panels = (
    <CanvasPanels
      content={c}
      page={page}
      api={api}
      base={base}
      editing={editing}
      selected={selected}
      privateAssets={privateAssets}
    />
  );
  const effects = c.interactions || defaultInteractions;
  const design = c.design || defaultDesign;
  const styles = Object.fromEntries(
    Object.entries(design).map(([key, value]) => [
      (
        {
          background: "--color-bg",
          surface: "--color-surface",
          raised: "--color-raised",
          text: "--color-text",
          muted: "--color-muted",
          accent: "--color-accent",
          width: "--page-width",
          radius: "--radius",
        } as Record<string, string>
      )[key],
      typeof value === "number" ? `${value}px` : value,
    ]),
  ) as CSSProperties;
  if (pageLayout) {
    (styles as Record<string, unknown>)["--workspace-gap"] =
      `${pageLayout.gap}px`;
    (styles as Record<string, unknown>)["--workspace-padding"] =
      `${pageLayout.padding}px`;
  }
  const links = [
    ["home", "首頁", "Home"],
    ["work", "作品", "Selected work"],
    ["journal", "筆記", "Journal"],
    ["about", "關於", "About & contact"],
    ["resources", "資源", "Resources"],
  ] as const;
  return (
    <div
      className={`site theme-${c.settings.theme === "verdant" ? "verdant" : "prism"} page-${page}`}
      style={c.design || pageLayout ? styles : undefined}
      data-card-effect={effects.card}
      data-tilt={effects.tilt}
      data-damping={effects.damping}
      data-press={effects.press ?? effects.ripple ?? true}
      data-transition={effects.transition}
      data-editing={editing}
    >
      <a className="skip-link" href="#main">
        跳至主要內容
      </a>
      <main id="main">
        <div className="hero-frame">
          {pageLayout?.builtins !== false && page === "home" && scenic && (
            <img
              className="lunar-backdrop"
              src={img(scenic)}
              alt={
                c.hero.image === "/assets/prism.svg" ||
                c.hero.image === "/assets/lunar-landscape.webp"
                  ? ""
                  : c.hero.alt
              }
              width="1672"
              height="941"
              fetchPriority="high"
              decoding="async"
            />
          )}
          <header
            className="site-header"
            {...elementProps(c, "header", editing)}
          >
            <a
              className={`wordmark ${editing && selected === "settings" ? "is-selected" : ""}`}
              data-edit={editing ? "settings" : undefined}
              data-page-target="home"
              href={editing ? "#top" : url()}
              aria-label={`${c.settings.name} 首頁`}
            >
              <img
                className="brand-mark"
                src={img(c.presentation?.logo || "/assets/outdesign-mark.webp")}
                width="36"
                height="36"
                alt=""
              />
              <span>{c.settings.name}</span>
            </a>
            <div className="header-actions">
              <button
                className="menu-toggle"
                data-edit={editing ? "copy:menu.label" : undefined}
                data-menu-toggle
                aria-controls="site-navigation"
                aria-expanded="false"
                aria-label="開啟選單"
              >
                <span>{text("menu.label")}</span>
                <Icon name="menu" size={20} />
              </button>
            </div>
          </header>
          {pageLayout?.builtins === false ? null : page === "home" ? (
            <section
              className={`hero${editing ? ` editable ${selected === "hero" ? "is-selected" : ""}` : ""}`}
              id="top"
              {...elementProps(c, "hero", editing)}
              data-edit={editing ? "hero" : undefined}
            >
              <div className="hero-copy">
                <p className="eyebrow" data-field="上方短句">
                  {c.hero.eyebrow}
                </p>
                <h1>
                  <span data-field="標題第一行">{c.hero.line1}</span>
                  <br />
                  <span data-field="標題第二行">{c.hero.line2}</span>
                </h1>
                <p
                  className="hero-description preserve-lines"
                  data-field="介紹文字"
                >
                  {c.hero.description}
                </p>
              </div>
              <a
                className={`mission-card glass-surface${editing && selected === "about" ? " is-selected" : ""}`}
                {...elementProps(c, "mission", editing)}
                data-page-target="about"
                href={url("about")}
                data-optical-card
                data-edit={editing ? "about" : undefined}
              >
                <div className="card-meta">
                  <span>
                    01 <i />
                  </span>
                  <span>{text("mission.meta")}</span>
                </div>
                <div className="mission-body">
                  <div>
                    <p className="mission-kicker">{text("mission.kicker")}</p>
                    <h2 className="preserve-lines" data-field="關於我的標題">
                      {c.about.title}
                    </h2>
                    <p className="mission-description">{c.about.body}</p>
                    <span className="mission-link">
                      <span className="circle-arrow">
                        <Icon name="arrow" size={18} />
                      </span>
                      {text("mission.link")}
                    </span>
                  </div>
                  <div className="mission-study">
                    <img
                      src={img(
                        c.presentation?.missionImage ||
                          "/assets/lunar-landscape.webp",
                      )}
                      alt={c.presentation?.missionAlt || "銀光映照的月面山脈"}
                      width="320"
                      height="440"
                      loading="lazy"
                    />
                    <div className="mission-values preserve-lines">
                      {text(
                        "mission.values",
                        "DESIGN\nDEVELOPMENT\nPOSSIBILITIES",
                      )}
                    </div>
                  </div>
                </div>
              </a>
              {first && (
                <a
                  className={`featured-card glass-surface${editing && selected === `project:${first.id}` ? " is-selected" : ""}`}
                  {...elementProps(c, `project-${first.id}`, editing)}
                  data-optical-card
                  data-edit={editing ? `project:${first.id}` : undefined}
                  data-page-target="work"
                  href={`${url("work")}#project-${first.id}`}
                >
                  <div className="card-meta">
                    <span>
                      02 <i />
                    </span>
                    <span>{text("featured.meta")}</span>
                  </div>
                  <div className="featured-body">
                    <img
                      src={img(first.image)}
                      alt={first.alt}
                      width="340"
                      height="220"
                      loading="lazy"
                    />
                    <div>
                      <h2>{first.title}</h2>
                      <p>{first.description}</p>
                      <span className="text-link">
                        {text("featured.link")} <Icon name="arrow" size={14} />
                      </span>
                    </div>
                  </div>
                </a>
              )}
              <div className="hero-bottom">
                <span className="scroll-cue" aria-hidden="true">
                  <span className="scroll-line" />
                  {text("hero.scroll")}
                </span>
              </div>
            </section>
          ) : (
            <div className="page-intro" id="top">
              <p className="eyebrow">
                OUTDESIGN /{" "}
                {page === "work"
                  ? "SELECTED WORK"
                  : page === "journal"
                    ? "JOURNAL"
                    : page === "resources"
                      ? "RESOURCES"
                      : "ABOUT"}
              </p>
              <h1>
                {page === "work" ? (
                  <>
                    {text("intro.work.first")}
                    <em>{text("intro.work.second")}</em>
                  </>
                ) : page === "journal" ? (
                  <>
                    {text("intro.journal.first")}
                    <em>{text("intro.journal.second")}</em>
                  </>
                ) : page === "resources" ? (
                  <>
                    {text("intro.resources.first")}
                    <em>{text("intro.resources.second")}</em>
                  </>
                ) : (
                  <>
                    {text("intro.about.first")}
                    <em>{text("intro.about.second")}</em>
                  </>
                )}
              </h1>
              <p>{text(`intro.${page}.description`)} </p>
              <span className="page-intro-number">
                {page === "work"
                  ? "02"
                  : page === "journal"
                    ? "03"
                    : page === "resources"
                      ? "05"
                      : "04"}
              </span>
            </div>
          )}
        </div>
        <dialog
          className="nav-drawer"
          id="site-navigation"
          aria-labelledby="drawer-title"
        >
          <div className="drawer-top">
            <span id="drawer-title">{text("menu.title")}</span>
            <button
              className="icon-button"
              data-close-dialog
              aria-label="關閉選單"
            >
              <Icon name="close" />
            </button>
          </div>
          <nav aria-label="主要導覽">
            {links
              .filter(([key]) => key !== "journal" || c.settings.showNotes)
              .map(([key, label, english], i) => (
                <a
                  key={key}
                  data-page-target={key}
                  href={url(key === "home" ? "" : key)}
                  aria-current={page === key ? "page" : undefined}
                >
                  <span className="nav-index">0{i + 1}</span>
                  <span>
                    {text(`nav.${key}`, label)}
                    <small>{english}</small>
                  </span>
                  <Icon name="diagonal" />
                </a>
              ))}
          </nav>
        </dialog>
        {pageLayout?.position === "before" && panels}
        <div className="page-content">
          {(pageLayout?.builtins === false ? [] : sections).map((section) => (
            <ContentSection
              key={section}
              section={section}
              content={c}
              api={api}
              base={base}
              editing={editing}
              selected={selected}
              privateAssets={privateAssets}
            />
          ))}
        </div>
        {pageLayout?.position !== "before" && panels}
      </main>
      <footer
        {...elementProps(c, "footer", editing)}
        className="site-footer section-shell"
        data-edit={editing ? "settings" : undefined}
      >
        <div className="footer-meta">
          <span>
            © {new Date().getUTCFullYear()} {c.settings.name}
          </span>
          <button data-studio-launch className="author-link">
            <Icon name="lock" size={12} />
            {text("footer.author")}
          </button>
          <a href="#top" aria-label="回到頂端">
            ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
