import type {
  Appearance,
  SiteContent,
} from "../../supabase/functions/_shared/schema";
import type { CSSProperties } from "react";
export const copyDefaults: Record<string, string> = {
  "work.eyebrow": "01 / SELECTED WORK",
  "notes.eyebrow": "02 / NOTES & THOUGHTS",
  "about.eyebrow": "03 / A LITTLE ABOUT ME",
  "contact.eyebrow": "04 / LET'S MAKE SOMETHING",
  "resources.eyebrow": "RESOURCES / 下載附件",
  "music.eyebrow": "ON MY FREQUENCY",
  "mission.values": "DESIGN\nDEVELOPMENT\nPOSSIBILITIES",
  "contact.github": "GitHub ↗",
  "contact.instagram": "Instagram ↗",
  "filter.0": "全部",
  "filter.1": "設計",
  "filter.2": "開發",
  "filter.3": "實驗",
  "menu.label": "探索",
  "menu.title": "EXPLORE THE SPACE",
  "nav.home": "首頁",
  "nav.work": "作品",
  "nav.journal": "筆記",
  "nav.about": "關於",
  "nav.resources": "資源",
  "mission.meta": "THE WAY I CREATE",
  "mission.kicker": "A quieter kind of digital.",
  "mission.link": "關於我的創作",
  "featured.meta": "SELECTED PROJECT",
  "featured.link": "查看作品",
  "hero.scroll": "往下探索",
  "footer.author": "作者模式",
  "intro.work.first": "想法，",
  "intro.work.second": "成為作品。",
  "intro.journal.first": "思考，",
  "intro.journal.second": "留下痕跡。",
  "intro.resources.first": "靈感，",
  "intro.resources.second": "隨手收藏。",
  "intro.about.first": "設計與技術之間，",
  "intro.about.second": "保留一點好奇。",
  "intro.work.description": "一個持續生長的作品集。關於介面、體驗與實驗。",
  "intro.journal.description": "記錄靈感、日常觀察，以及創作過程中的一些發現。",
  "intro.resources.description": "整理常用連結、檔案與可下載的創作資源。",
  "intro.about.description": "讓想法成為可以被看見、被使用的事物。",
  "work.heading.first": "一些作品，",
  "work.heading.second": "一些探索。",
  "work.description": "從想法到實作，\n讓每一個細節都有它的理由。",
  "work.collection": "A COLLECTION OF THINGS I MAKE",
  "notes.heading.first": "想法的",
  "notes.heading.second": "切片。",
  "notes.description": "寫下來，讓思考繼續發生。",
  "about.heading": "關於我",
  "contact.heading": "一起聊聊",
  "resources.heading": "檔案與資源",
};
export function presentationCopy(
  content: SiteContent,
  key: string,
  fallback = copyDefaults[key] || "",
) {
  return content.presentation?.copy?.[key] ?? fallback;
}
export const shadows = {
  none: "none",
  soft: "0 12px 32px #00000024",
  deep: "0 24px 64px #00000050",
};
export function appearanceStyle(values?: Appearance): CSSProperties {
  if (!values) return {};
  return {
    color: values.color,
    background: values.background,
    borderColor: values.borderColor,
    ...(values.borderWidth !== undefined
      ? { borderWidth: values.borderWidth, borderStyle: "solid" }
      : {}),
    boxShadow: values.shadow ? shadows[values.shadow] : undefined,
  };
}
export function elementProps(
  content: SiteContent,
  key: string,
  editing = false,
): {
  style?: CSSProperties;
  hidden?: boolean;
  "data-element-font"?: boolean;
  "data-effect"?: string;
} {
  const values = content.presentation?.elements?.[key];
  if (!values) return {};
  const { radius, hidden, borderColor, borderWidth, shadow, effect, ...style } =
    values;
  return {
    style: {
      ...style,
      ...appearanceStyle({ borderColor, borderWidth, shadow }),
      borderRadius: radius,
      opacity: editing && hidden ? 0.35 : style.opacity,
    },
    hidden: !editing && hidden,
    "data-effect": effect,
    "data-element-font": style.fontSize !== undefined || undefined,
  };
}
