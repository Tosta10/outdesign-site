import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const assetId = z.uuid();
export function safeUrl(value: string): boolean {
  if (!value) return true;
  if (/^asset:[0-9a-f-]{36}$/i.test(value))
    return assetId.safeParse(value.slice(6)).success;
  if (
    /^\/assets\/[a-z0-9._/-]+$/i.test(value) &&
    !value.includes("..") &&
    !value.includes("//")
  )
    return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
const mediaUrl = text(2048).refine(safeUrl, "請使用 HTTPS 網址或上傳素材");
const externalUrl = text(2048).refine(
  (v) => !v || (safeUrl(v) && v.startsWith("https://")),
  "請使用完整 HTTPS 網址",
);
export const projectSchema = z
  .object({
    id: z.uuid(),
    title: text(80).min(1),
    category: z.enum(["設計", "開發", "實驗"]),
    description: text(500),
    year: text(12),
    image: mediaUrl,
    alt: text(160),
    url: externalUrl,
    tone: z.enum(["lilac", "silver", "warm"]),
    demo: z.boolean(),
  })
  .strict();
export const noteSchema = z
  .object({
    id: z.uuid(),
    title: text(100).min(1),
    excerpt: text(600),
    date: text(32),
    tag: text(24),
    url: externalUrl,
  })
  .strict();
export const attachmentSchema = z
  .object({
    id: z.uuid(),
    name: text(100).min(1),
    url: mediaUrl.refine((v) => Boolean(v), "請填寫附件網址"),
    label: text(30),
  })
  .strict();
export const contentSchema = z
  .object({
    schemaVersion: z.literal(1),
    settings: z
      .object({
        name: text(60).min(1),
        siteTitle: text(100).min(1),
        description: text(220),
        theme: z.enum(["prism", "quiet", "luminous"]),
        showNotes: z.boolean(),
        showMusic: z.boolean(),
      })
      .strict(),
    hero: z
      .object({
        eyebrow: text(80),
        line1: text(32).min(1),
        line2: text(32).min(1),
        description: text(500),
        image: mediaUrl,
        alt: text(160),
      })
      .strict(),
    projects: z.array(projectSchema).max(24),
    notes: z.array(noteSchema).max(30),
    about: z
      .object({
        title: text(100),
        body: text(2000),
        tags: z.array(text(30)).max(8),
      })
      .strict(),
    contact: z
      .object({
        headline: text(100),
        email: z.email().max(254),
        instagram: externalUrl,
        github: externalUrl,
      })
      .strict(),
    music: z
      .object({ title: text(100), artist: text(100), url: mediaUrl })
      .strict(),
    attachments: z.array(attachmentSchema).max(20),
    layout: z
      .object({
        sections: z
          .array(z.enum(["work", "notes", "about", "attachments", "contact"]))
          .length(5)
          .refine((items) => new Set(items).size === 5, "每個區塊只能出現一次"),
      })
      .strict()
      .optional(),
  })
  .strict();
export type SiteContent = z.infer<typeof contentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Selection =
  | "hero"
  | "about"
  | "contact"
  | "settings"
  | "music"
  | `project:${string}`
  | `note:${string}`;
export const credentialsSchema = z
  .object({
    password1: z.string().min(12).max(200),
    password2: z.string().min(12).max(200),
  })
  .strict();
export function collectAssetIds(content: SiteContent): string[] {
  return [
    ...new Set(
      [
        content.hero.image,
        content.music.url,
        ...content.projects.map((p) => p.image),
        ...content.attachments.map((a) => a.url),
      ]
        .filter((v) => v.startsWith("asset:"))
        .map((v) => v.slice(6)),
    ),
  ];
}
export const uploadTypes: Record<
  string,
  { extension: string; kind: "image" | "audio" | "file"; limit: number }
> = {
  "image/jpeg": { extension: "jpg", kind: "image", limit: 10_000_000 },
  "image/png": { extension: "png", kind: "image", limit: 10_000_000 },
  "image/webp": { extension: "webp", kind: "image", limit: 10_000_000 },
  "image/avif": { extension: "avif", kind: "image", limit: 10_000_000 },
  "image/gif": { extension: "gif", kind: "image", limit: 10_000_000 },
  "audio/mpeg": { extension: "mp3", kind: "audio", limit: 25_000_000 },
  "audio/wav": { extension: "wav", kind: "audio", limit: 25_000_000 },
  "audio/x-wav": { extension: "wav", kind: "audio", limit: 25_000_000 },
  "audio/ogg": { extension: "ogg", kind: "audio", limit: 25_000_000 },
  "audio/mp4": { extension: "m4a", kind: "audio", limit: 25_000_000 },
  "application/pdf": { extension: "pdf", kind: "file", limit: 15_000_000 },
  "application/zip": { extension: "zip", kind: "file", limit: 25_000_000 },
  "text/plain": { extension: "txt", kind: "file", limit: 1_000_000 },
};
