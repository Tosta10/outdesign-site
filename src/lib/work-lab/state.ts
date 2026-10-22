import { labEffects } from "../../../supabase/functions/_shared/work-lab-config.ts";
export type LabMode = "browse" | "detail" | "inspect";
export const families = ["全部", "設計", "開發", "實驗"] as const;
export type LabItem = {
  id: number;
  key: string;
  family: number;
  category: string;
  variant: number;
  code: string;
  title: string;
  english: string;
  description: string;
  image: string;
  alt: string;
  url: string;
  year: string;
  empty: boolean;
};
export function wrap(value: number, period: number) {
  return ((value % period) + period) % period;
}
export function createLabItems(
  projects: {
    id: string;
    title: string;
    category: string;
    description: string;
    image: string;
    alt: string;
    url: string;
    year: string;
  }[],
): LabItem[] {
  return projects.length
    ? projects.map((p, i) => ({
        id: i,
        key: p.id,
        family: Math.max(
          1,
          families.indexOf(p.category as (typeof families)[number]),
        ),
        category: p.category,
        variant: 0,
        code: `NO.${String(i + 1).padStart(3, "0")}`,
        title: p.title,
        english: `${p.category} / ${p.year}`,
        description: p.description,
        image: p.image,
        alt: p.alt,
        url: p.url,
        year: p.year,
        empty: false,
      }))
    : [
        {
          id: 0,
          key: "empty",
          family: 0,
          category: "作品",
          variant: 0,
          code: "NO.001",
          title: "下一件作品，從這裡開始。",
          english: "YOUR NEXT WORK",
          description:
            "原有作品欄位已清空。新增作品與封面後，圖片會以平面嵌入玻璃卡帶，與作品資料一起呈現。",
          image: "",
          alt: "",
          url: "",
          year: "—",
          empty: true,
        },
      ];
}
export function itemAt(items: LabItem[], row: number): LabItem {
  return items[wrap(Math.round(row), items.length)];
}
export function nearest(value: number, around: number, period: number) {
  return value + Math.round((around - value) / period) * period;
}
export function relax(current: number, target: number, dt: number, speed = 10) {
  return (
    target +
    (current - target) * Math.exp(-speed * Math.min(0.05, Math.max(0, dt)))
  );
}
export function pulse(distance: number, age: number) {
  if (age < 0 || age > 2.4) return 0;
  const offset = distance - age * 5;
  return (
    Math.exp((-offset * offset) / 4 - age * 1.6) * Math.sin(offset * 1.8) * 0.38
  );
}
export function revealAt(progress: number, height: number) {
  const v = Math.max(0, Math.min(1, (progress * 1.2 - (1 - height)) / 0.2));
  return v * v * (3 - 2 * v);
}
export const parts = [
  "卡帶框架",
  "玻璃蓋板",
  "作品圖像平面",
  "內層襯底",
  "資訊基板",
  "固定構件",
];
export const motionLabels = labEffects;
export type MotionKey = keyof typeof motionLabels;
export type LabPreferences = {
  theme: "dark" | "light";
  quality: "low" | "medium" | "high";
  motion: boolean;
  motionPreset: "system" | "full" | "reduced";
  effects: Record<MotionKey, boolean>;
  sound: boolean;
  ambient: boolean;
  volume: number;
};
export function normalizePreferences(
  value: unknown,
  reduced = false,
): LabPreferences {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    theme: input.theme === "dark" ? "dark" : "light",
    quality:
      input.quality === "high" || input.quality === "low"
        ? input.quality
        : "medium",
    motion:
      input.motionPreset === "full" ||
      (input.motionPreset !== "reduced" && !reduced && input.motion !== false),
    motionPreset:
      input.motionPreset === "full" || input.motionPreset === "reduced"
        ? input.motionPreset
        : "system",
    effects: Object.fromEntries(
      Object.keys(motionLabels).map((key) => [
        key,
        (input.effects && typeof input.effects === "object"
          ? (input.effects as Record<string, unknown>)[key]
          : true) !== false,
      ]),
    ) as Record<MotionKey, boolean>,
    sound: input.sound === true,
    ambient: input.ambient === true,
    volume:
      typeof input.volume === "number" && Number.isFinite(input.volume)
        ? Math.max(0, Math.min(0.3, input.volume))
        : 0.12,
  };
}

// A lane is a category; rows are independent works inside that category.
export function archiveColumns(items: LabItem[]) {
  const labels = [...new Set(items.map((item) => item.category))];
  return labels.map((label) => ({
    label,
    items: items.filter((item) => item.category === label),
  }));
}
export function itemAtCell(items: LabItem[], lane: number, row: number) {
  const columns = archiveColumns(items);
  return itemAt(columns[wrap(Math.round(lane), columns.length)].items, row);
}
export function locateItem(items: LabItem[], key: string) {
  const columns = archiveColumns(items);
  const lane = Math.max(
    0,
    columns.findIndex((column) =>
      column.items.some((item) => item.key === key),
    ),
  );
  return {
    lane,
    row: Math.max(
      0,
      columns[lane].items.findIndex((item) => item.key === key),
    ),
  };
}
export const ARCHIVE_LAYOUT = {
  width: 3.44,
  height: 2.94,
  depth: 0.22,
  columnGap: 4.15,
  rowGap: 0.62,
  cassetteDepth: 0.5,
  lanes: 9,
  rows: 65,
} as const;

export function motionAllowed(preferences: LabPreferences, key: MotionKey) {
  return preferences.motion && preferences.effects[key];
}
