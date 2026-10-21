import type { SiteContent } from "../../supabase/functions/_shared/schema";
export const sourceLabels: Record<string, string> = {
  "hero.eyebrow": "上方短句",
  "hero.line1": "標題第一行",
  "hero.line2": "標題第二行",
  "hero.description": "介紹文字",
  "hero.image": "主視覺圖片",
  "about.title": "關於我的標題",
  "about.body": "關於我的內文",
  "contact.headline": "聯絡標題",
  "contact.email": "電子郵件",
  "music.title": "歌曲名稱",
  "music.artist": "音樂演出者",
  "settings.name": "網站顯示名稱",
};
export const sourceKey = (path: string) => `field-${path.replaceAll(".", "-")}`;
export function sourcePath(
  key: string,
  content: SiteContent,
): string | undefined {
  const paths = [
    ...Object.keys(sourceLabels),
    ...content.projects.flatMap((p) =>
      ["title", "description", "image", "year", "alt"].map(
        (k) => `projects.${p.id}.${k}`,
      ),
    ),
    ...content.notes.flatMap((n) =>
      ["title", "excerpt", "date", "tag"].map((k) => `notes.${n.id}.${k}`),
    ),
    ...content.attachments.flatMap((a) =>
      ["name", "label", "url"].map((k) => `attachments.${a.id}.${k}`),
    ),
  ];
  return paths.find((p) => sourceKey(p) === key);
}
export function readSource(content: SiteContent, path: string): string {
  const [group, id, field] = path.split(".");
  if (["projects", "notes", "attachments"].includes(group))
    return String(
      (
        content[group as "projects"] as unknown as Record<string, string>[]
      ).find((p) => p.id === id)?.[field] || "",
    );
  return String(
    (content[group as "hero"] as unknown as Record<string, string>)[id] || "",
  );
}
export function writeSource(content: SiteContent, path: string, value: string) {
  const [group, id, field] = path.split(".");
  if (["projects", "notes", "attachments"].includes(group)) {
    const item = (
      content[group as "projects"] as unknown as Record<string, string>[]
    ).find((p) => p.id === id);
    if (item) item[field] = value;
  } else
    (content[group as "hero"] as unknown as Record<string, string>)[id] = value;
}
