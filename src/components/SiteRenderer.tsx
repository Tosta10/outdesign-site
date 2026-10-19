import type { CSSProperties } from "react";
import {
  defaultDesign,
  defaultInteractions,
} from "../../supabase/functions/_shared/schema";
import { assetUrl } from "../lib/content";
import { Icon } from "./Icon";
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
  const scenic =
    c.hero.image === "/assets/prism.svg"
      ? "/assets/lunar-landscape.webp"
      : c.hero.image;
  const first = c.projects[0];
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
  const links = [
    ["home", "首頁", "Home"],
    ["work", "作品", "Selected work"],
    ["journal", "筆記", "Journal"],
    ["about", "關於", "About & contact"],
    ["resources", "資源", "Resources"],
  ] as const;
  return (
    <div
      className={`site theme-${c.settings.theme} page-${page}`}
      style={c.design ? styles : undefined}
      data-card-effect={effects.card}
      data-tilt={effects.tilt}
      data-damping={effects.damping}
      data-ripple={effects.ripple}
      data-transition={effects.transition}
      data-editing={editing}
    >
      <a className="skip-link" href="#main">
        跳至主要內容
      </a>
      <main id="main">
        <div className="hero-frame">
          {page === "home" && scenic && (
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
          <header className="site-header">
            <a
              className="wordmark"
              data-page-target="home"
              href={editing ? "#top" : url()}
              aria-label={`${c.settings.name} 首頁`}
            >
              <span className="brand-moon" aria-hidden="true" />
              <span>{c.settings.name}</span>
            </a>
            <p className="header-caption">INDEPENDENT DESIGN & DEVELOPMENT</p>
            <div className="header-actions">
              <button
                className="header-author"
                data-studio-launch
                aria-label="開啟作者登入"
              >
                <Icon name="lock" size={13} />
                <span>作者入口</span>
              </button>
              <span className="header-divider" />
              <button
                className="menu-toggle"
                data-menu-toggle
                aria-controls="site-navigation"
                aria-expanded="false"
                aria-label="開啟選單"
              >
                <span>探索</span>
                <Icon name="menu" size={20} />
              </button>
            </div>
          </header>
          {page === "home" ? (
            <section
              className={`hero${editing ? ` editable ${selected === "hero" ? "is-selected" : ""}` : ""}`}
              id="top"
              data-edit={editing ? "hero" : undefined}
            >
              <div className="hero-copy">
                <p className="eyebrow">{c.hero.eyebrow}</p>
                <h1>
                  {c.hero.line1}
                  <br />
                  <span>{c.hero.line2}</span>
                </h1>
                <p className="hero-description preserve-lines">
                  {c.hero.description}
                </p>
                <a
                  className="hero-explore"
                  data-page-target="work"
                  href={url("work")}
                >
                  <span className="circle-arrow">
                    <Icon name="arrow" size={19} />
                  </span>
                  <span className="hairline" />
                  <span>探索我的作品</span>
                </a>
              </div>
              <a
                className="mission-card glass-surface"
                data-page-target="about"
                href={url("about")}
                data-optical-card
              >
                <div className="card-meta">
                  <span>
                    01 <i />
                  </span>
                  <span>THE WAY I CREATE</span>
                </div>
                <div className="mission-body">
                  <div>
                    <p className="mission-kicker">A quieter kind of digital.</p>
                    <h2 className="preserve-lines">{c.about.title}</h2>
                    <p className="mission-description">{c.about.body}</p>
                    <span className="mission-link">
                      <span className="circle-arrow">
                        <Icon name="arrow" size={18} />
                      </span>
                      關於我的創作
                    </span>
                  </div>
                  <div className="mission-study">
                    <img
                      src={img("/assets/lunar-landscape.webp")}
                      alt="銀光映照的月面山脈"
                      width="320"
                      height="440"
                      loading="lazy"
                    />
                    <div className="mission-values">
                      DESIGN
                      <br />
                      DEVELOPMENT
                      <br />
                      POSSIBILITIES
                    </div>
                  </div>
                </div>
              </a>
              {first && (
                <a
                  className="featured-card glass-surface"
                  data-optical-card
                  data-page-target="work"
                  href={`${url("work")}#project-${first.id}`}
                >
                  <div className="card-meta">
                    <span>
                      02 <i />
                    </span>
                    <span>SELECTED PROJECT</span>
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
                        查看作品 <Icon name="arrow" size={14} />
                      </span>
                    </div>
                  </div>
                </a>
              )}
              <div className="hero-bottom">
                <a
                  className="scroll-cue"
                  data-page-target="work"
                  href={url("work")}
                >
                  <span className="scroll-line" />
                  EXPLORE SELECTED WORK
                </a>
                <div className="page-indicators">
                  <span>01</span>
                  <i />
                  <span className="muted">/ 05</span>
                </div>
                <span className="hero-signature">
                  <i /> A SPACE FOR WHAT COMES NEXT
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
                    想法，<em>成為作品。</em>
                  </>
                ) : page === "journal" ? (
                  <>
                    思考，<em>留下痕跡。</em>
                  </>
                ) : page === "resources" ? (
                  <>
                    靈感，<em>隨手收藏。</em>
                  </>
                ) : (
                  <>
                    設計與技術之間，<em>保留一點好奇。</em>
                  </>
                )}
              </h1>
              <p>
                {page === "work"
                  ? "一個持續生長的作品集。關於介面、體驗與實驗。"
                  : page === "journal"
                    ? "記錄靈感、日常觀察，以及創作過程中的一些發現。"
                    : page === "resources"
                      ? "整理常用連結、檔案與可下載的創作資源。"
                      : "讓想法成為可以被看見、被使用的事物。"}
              </p>
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
            <span id="drawer-title">EXPLORE THE SPACE</span>
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
                    {label}
                    <small>{english}</small>
                  </span>
                  <Icon name="diagonal" />
                </a>
              ))}
          </nav>
          <div className="drawer-bottom">
            <span>MADE WITH INTENTION.</span>
            <button data-studio-launch data-close-dialog>
              作者入口 <Icon name="lock" size={12} />
            </button>
          </div>
        </dialog>
        <div className="page-content">
          {sections.map((section) => (
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
      </main>
      <footer className="site-footer section-shell">
        <div>
          <a className="footer-brand" href={url()}>
            <span className="brand-moon" />
            {c.settings.name}
          </a>
          <p>A LITTLE MORE INTENTION. A LITTLE LESS NOISE.</p>
        </div>
        <div className="footer-meta">
          <span>
            © {new Date().getUTCFullYear()} {c.settings.name}
          </span>
          <button data-studio-launch className="author-link">
            <Icon name="lock" size={12} />
            作者模式
          </button>
          <a href="#top" aria-label="回到頂端">
            ↑
          </a>
        </div>
      </footer>
    </div>
  );
}
