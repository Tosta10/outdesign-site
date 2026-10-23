import "../styles/site-theme.css";
import { EditorialSite } from "./EditorialSite";
import { GearIcon } from "./GearIcon";
import type { CSSProperties } from "react";
import {
  defaultDesign,

} from "../../supabase/functions/_shared/schema";
import { elementProps } from "../lib/presentation";
import { assetUrl } from "../lib/content";
import { CanvasPanels } from "./CanvasPanels";
import { WorkLab } from "./WorkLab";
import { Icon } from "./Icon";


import type { SectionProps } from "./ContentSection";

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
  if (page === "work")
    return (
      <div className="site page-work" data-site-theme={c.workLab?.options.theme || "light"} data-editing={editing} style={styles}>
        <a className="skip-link" href="#main">
          跳至主要內容
        </a>
        <main id="main">
          <section
            id="work"
            className="work-section"
            data-layout="section:work"
            {...elementProps(c, "work", editing)}
            data-edit={editing ? "projects" : undefined}
          >
            <WorkLab content={c} editing={editing} imageUrl={img} homeUrl={url()} />
          </section>
          <div className="lab-author-overlay">{panels}</div>
        </main>
        <dialog
          className="nav-drawer"
          id="site-navigation"
          aria-label="網站選單"
        >
          <div className="drawer-top">
            <span>OUTDESIGN / MENU</span>
            <button data-close-dialog aria-label="關閉選單">
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
                  aria-current={key === page ? "page" : undefined}
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
          <button className="site-settings-button" {...elementProps(c, "lab-action-settings-1", editing)} data-lab-settings-open aria-label="開啟展示設定"><GearIcon /><span>設定</span></button>
        </dialog>
        {!editing &&
          c.workspace?.scripts?.some(
            (script) => script.page === page && script.enabled,
          ) && (
            <script
              type="application/json"
              data-site-logic
              dangerouslySetInnerHTML={{
                __html: JSON.stringify(
                  c.workspace.scripts.filter(
                    (script) => script.page === page && script.enabled,
                  ),
                ).replaceAll("<", "\\u003c"),
              }}
            />
          )}
      </div>
    );
  return <EditorialSite content={c} api={api} base={base} editing={editing} selected={selected} privateAssets={privateAssets} page={page}/>;
}
