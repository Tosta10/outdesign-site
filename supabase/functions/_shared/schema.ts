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
export const interactionSchema = z
  .object({
    card: z.enum(["none", "lift", "tilt", "scale", "glow", "outline"]),
    tilt: z.number().min(1).max(6),
    damping: z.number().min(0.06).max(0.3),
    transition: z.enum(["none", "fade", "slide"]),
    press: z.boolean().optional(),
    ripple: z.boolean().optional(), // Read-only compatibility with older saved content.
  })
  .strict();
export const defaultInteractions: z.infer<typeof interactionSchema> = {
  card: "tilt",
  tilt: 3,
  damping: 0.12,
  transition: "fade",
  press: true,
};
export const designSchema = z
  .object({
    background: z.string().regex(/^#[0-9a-f]{6}$/i),
    surface: z.string().regex(/^#[0-9a-f]{6}$/i),
    raised: z.string().regex(/^#[0-9a-f]{6}$/i),
    text: z.string().regex(/^#[0-9a-f]{6}$/i),
    muted: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    width: z.number().int().min(960).max(1600),
    radius: z.number().int().min(0).max(32),
  })
  .strict();
export const defaultDesign: z.infer<typeof designSchema> = {
  background: "#0a0a0a",
  surface: "#141414",
  raised: "#1c1c1c",
  text: "#efefec",
  muted: "#a0a09f",
  accent: "#d3cde2",
  width: 1280,
  radius: 12,
};
export const canvasPage = z.enum([
  "home",
  "work",
  "journal",
  "about",
  "resources",
]);
export const appearanceSchema = z
  .object({
    color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    background: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    borderColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    borderWidth: z.number().min(0).max(8).optional(),
    shadow: z.enum(["none", "soft", "deep"]).optional(),
    effect: z
      .enum(["none", "lift", "tilt", "scale", "glow", "outline"])
      .optional(),
  })
  .strict();
export type Appearance = z.infer<typeof appearanceSchema>;
export const canvasNodeSchema = z
  .object({
    id: z.uuid(),
    page: canvasPage,
    parent: z.uuid().nullable(),
    type: z.enum(["frame", "text", "image", "link", "divider"]),
    name: text(60).min(1),
    body: text(4000),
    url: externalUrl,
    image: mediaUrl,
    alt: text(160),
    layout: z.enum(["vertical", "horizontal", "grid", "free"]),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(3000),
    width: z.number().min(80).max(1600),
    height: z.number().min(40).max(2000),
    sizing: z.enum(["fill", "fixed", "hug"]),
    gap: z.number().min(0).max(120),
    padding: z.number().min(0).max(120),
    columns: z.number().int().min(1).max(6),
    align: z.enum(["start", "center", "end"]),
    fill: z.enum(["none", "surface", "raised", "accent"]),
    border: z.boolean(),
    radius: z.number().min(0).max(40),
    fontSize: z.number().min(12).max(96),
    opacity: z.number().min(0.1).max(1),
    hidden: z.boolean(),
    locked: z.boolean(),
    appearance: appearanceSchema.optional(),
  })
  .strict();
export type CanvasNode = z.infer<typeof canvasNodeSchema>;
function validateTree(items: CanvasNode[], ctx: z.RefinementCtx) {
  const nodes = new Map(items.map((node) => [node.id, node]));
  if (nodes.size !== items.length)
    ctx.addIssue({ code: "custom", message: "圖層 ID 不可重複" });
  for (const node of items) {
    let parent = node.parent;
    const seen = new Set([node.id]);
    while (parent) {
      const frame = nodes.get(parent);
      if (
        !frame ||
        frame.type !== "frame" ||
        frame.page !== node.page ||
        seen.has(parent) ||
        seen.size > 6
      ) {
        ctx.addIssue({
          code: "custom",
          message: "圖層需位於同頁的有效面板中，不可循環或超過六層",
        });
        break;
      }
      seen.add(parent);
      parent = frame.parent;
    }
  }
}
export const assemblySchema = z
  .object({
    id: z.uuid(),
    name: text(60).min(1),
    nodes: z.array(canvasNodeSchema).min(1).max(30),
  })
  .strict()
  .superRefine((assembly, ctx) => {
    validateTree(assembly.nodes, ctx);
    const roots = assembly.nodes.filter((node) => !node.parent);
    if (
      roots.length !== 1 ||
      roots[0]?.type !== "frame" ||
      assembly.nodes.some((node) => node.page !== roots[0]?.page)
    )
      ctx.addIssue({
        code: "custom",
        message: "組裝須包含一個根面板，且所有積木位於同頁",
      });
  });
export type Assembly = z.infer<typeof assemblySchema>;
export const workspaceSchema = z
  .object({
    nodes: z.array(canvasNodeSchema).max(100),
    presets: z
      .array(assemblySchema)
      .max(8)
      .refine(
        (items) =>
          new Set(items.map((p) => p.id)).size === items.length &&
          new Set(items.map((p) => p.name)).size === items.length,
        "組裝名稱與 ID 不可重複",
      )
      .optional(),
    pages: z
      .record(
        canvasPage,
        z
          .object({
            gap: z.number().min(0).max(160),
            padding: z.number().min(0).max(160),
            builtins: z.boolean(),
            position: z.enum(["before", "after"]),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()
  .superRefine((workspace, ctx) => validateTree(workspace.nodes, ctx));
export const contentSchema = z
  .object({
    schemaVersion: z.literal(1),
    settings: z
      .object({
        name: text(60).min(1),
        siteTitle: text(100).min(1),
        description: text(220),
        theme: z.preprocess(
          (value) =>
            value === "quiet" || value === "luminous" ? "prism" : value,
          z.enum(["prism", "verdant"]),
        ),
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
    interactions: interactionSchema.optional(),
    design: designSchema.optional(),
    presentation: z
      .object({
        logo: mediaUrl.optional(),
        missionImage: mediaUrl.optional(),
        missionAlt: text(160).optional(),
        elements: z
          .record(
            z.string().regex(/^[a-z][a-zA-Z0-9.-]{0,79}$/),
            appearanceSchema
              .extend({
                padding: z.number().min(0).max(120).optional(),
                radius: z.number().min(0).max(40).optional(),
                fontSize: z.number().min(8).max(120).optional(),
                opacity: z.number().min(0.1).max(1).optional(),
                hidden: z.boolean().optional(),
              })
              .strict(),
          )
          .refine((v) => Object.keys(v).length <= 180)
          .optional(),
        copy: z
          .record(z.string().regex(/^[a-z][a-zA-Z0-9.-]{0,79}$/), text(500))
          .refine((v) => Object.keys(v).length <= 120)
          .optional(),
      })
      .strict()
      .optional(),
    workspace: workspaceSchema.optional(),
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
  | `copy:${string}`
  | "hero"
  | "about"
  | "contact"
  | "settings"
  | "music"
  | "projects"
  | "notes"
  | "attachments"
  | `node:${string}`
  | `project:${string}`
  | `note:${string}`;
export const credentialsSchema = z
  .object({
    password1: z.string().min(12).max(200),
    password2: z.string().min(12).max(200),
  })
  .strict();
/** Only new credentials use the stronger minimum; existing logins stay compatible. */
export const newCredentialsSchema = credentialsSchema
  .extend({
    password1: z.string().min(16).max(200),
    password2: z.string().min(16).max(200),
  })
  .refine(
    (value) => value.password1 !== value.password2,
    "請使用兩組不同的密碼",
  );
export function collectAssetIds(
  content: SiteContent,
  includePresets = false,
): string[] {
  return [
    ...new Set(
      [
        content.hero.image,
        content.presentation?.logo || "",
        content.presentation?.missionImage || "",
        content.music.url,
        ...content.projects.map((p) => p.image),
        ...content.attachments.map((a) => a.url),
        ...(content.workspace?.nodes.map((node) => node.image) || []),
        ...(includePresets
          ? content.workspace?.presets?.flatMap((p) =>
              p.nodes.map((n) => n.image),
            ) || []
          : []),
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
