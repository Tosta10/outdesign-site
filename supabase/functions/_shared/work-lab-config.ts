/** Shared by the author studio, bounded blocks, browser renderer and API validation. */
export const labParameters = {
  coverScale: { label: "封面貼合比例", min: .35, max: .82, step: .01, value: .64 },
  selectionDelay: { label: "選取待機秒數", min: 0, max: 2, step: .05, value: .45 },
  selectionSpeed: { label: "切換彈簧速度", min: 2, max: 16, step: .1, value: 3.7 },
  cameraFollow: { label: "相機跟隨速度", min: 5, max: 40, step: 1, value: 24 },
  cameraDistance: { label: "陣列相機距離倍率", min: .4, max: 1.2, step: .01, value: .6 },
  cameraTransition: { label: "鏡頭抽取過渡速度", min: 2, max: 20, step: .1, value: 8 },
  extractionSpeed: { label: "卡帶抽取速度", min: 2, max: 16, step: .1, value: 6 },
  returnSpeed: { label: "卡帶歸位速度", min: 2, max: 16, step: .1, value: 6 },
  shoulderSpeed: { label: "波峰追蹤速度", min: 2, max: 16, step: .1, value: 5 },
  columnSpeed: { label: "分類波峰追蹤", min: 2, max: 16, step: .1, value: 6 },
  waveAmplitude: { label: "選取波浪幅度", min: 0, max: 2, step: .05, value: 1 },
  waveSpeed: { label: "選取波浪速度", min: .25, max: 3, step: .05, value: 1 },
  waveLead: { label: "移動前方波動距離", min: 0, max: 16, step: .5, value: 6 },
  idleAmplitude: { label: "閒置起伏幅度", min: 0, max: 2, step: .05, value: 1 },
  idleSpeed: { label: "閒置起伏速度", min: .25, max: 3, step: .05, value: 1 },
  parallax: { label: "指標視差幅度", min: 0, max: .6, step: .01, value: .12 },
  inertia: { label: "拖曳慣性阻力", min: .5, max: 10, step: .1, value: 2.4 },
  snapSpeed: { label: "拖曳吸附速度", min: 3, max: 30, step: .5, value: 10 },
  revealDuration: { label: "玻璃解密秒數", min: .2, max: 4, step: .05, value: 1.65 },
  modelSpeed: { label: "拆解重組速度", min: 2, max: 20, step: .5, value: 6 },
  orbitFollow: { label: "360° 旋轉跟隨", min: 5, max: 40, step: 1, value: 20 },
  zoomFollow: { label: "360° 縮放跟隨", min: 5, max: 40, step: 1, value: 24 },
  panFollow: { label: "360° 平移跟隨", min: 5, max: 40, step: 1, value: 24 },
  bootDuration: { label: "開場秒數", min: .3, max: 5, step: .1, value: 3.2 },
  transitionDuration: { label: "文字過渡秒數", min: .1, max: 1.5, step: .05, value: .46 },
  explosionDistance: { label: "拆解間距倍率", min: .25, max: 2, step: .05, value: 1 },
  volume: { label: "音量", min: 0, max: 6, step: .01, value: 3 },
} as const;
export const labEffects = {
  boot: "開場動畫", selectionWave: "選取波浪", idleWave: "閒置起伏",
  pointerParallax: "指標視差", dragMomentum: "拖曳慣性",
  selectionTransition: "切列與切檔過渡", detailTransition: "抽取與歸位鏡頭",
  modelDecryption: "玻璃解密", documentReveal: "文件揭示",
  rollingText: "文字滾動", rollingNumbers: "數字滾動", surfaceTransitions: "面板轉場",
  viewerNavigation: "360° 導覽阻尼", viewerModelTransition: "拆解與重組過渡",
} as const;
export const labOptions = {
  theme: { label: "預設明暗", values: { light: "淺色", dark: "深色" }, value: "light" },
  quality: { label: "預設品質", values: { low: "省電", medium: "標準", high: "精細" }, value: "medium" },
  motionPreset: { label: "動態模式", values: { system: "依系統", full: "完整動態", reduced: "減少動態" }, value: "system" },
  sound: { label: "互動音效", values: { off: "關閉", on: "開啟" }, value: "off" },
  ambient: { label: "合成環境音", values: { off: "關閉", on: "開啟" }, value: "off" },
  glass: { label: "預設玻璃", values: { clear: "清晰", frosted: "磨砂" }, value: "clear" },
} as const;
export const labPalette = {
  shell: { label: "卡帶本體", value: "#e1dcd1" },
  frame: { label: "卡帶框架", value: "#e1dcd1" },
  back: { label: "資訊基板", value: "#c4beb2" },
  liner: { label: "內層襯底", value: "#e1dcd1" },
  accent: { label: "固定構件", value: "#8b8d88" },
  glass: { label: "玻璃色調", value: "#fffdf5" },
  top: { label: "頂部灰色邊條", value: "#969894" },
  darkShell: { label: "深色卡帶本體", value: "#11161c" },
  darkFrame: { label: "深色卡帶框架", value: "#11161c" },
  darkBack: { label: "深色資訊基板", value: "#080d12" },
  darkLiner: { label: "深色內層襯底", value: "#11161c" },
  darkAccent: { label: "深色固定構件", value: "#46515b" },
  darkGlass: { label: "深色玻璃色調", value: "#89979d" },
  darkTop: { label: "深色頂部灰色", value: "#484d52" },
} as const;
export const labActions = {
  next: "下一件作品", previous: "上一件作品", "next-column": "下一分類",
  "previous-column": "上一分類", open: "讀取作品", back: "返回陣列", inspect: "360° 檢視",
  explode: "切換拆解", assemble: "重組", glass: "切換磨砂", clear: "清晰玻璃",
  frosted: "磨砂玻璃", reset: "重設鏡頭", replay: "重播開場",
} as const;
export type LabParameter = keyof typeof labParameters;
export type LabEffect = keyof typeof labEffects;
export type WorkLabConfig = {
  parameters: Record<LabParameter, number>;
  effects: Record<LabEffect, boolean>;
  options: { [K in keyof typeof labOptions]: keyof typeof labOptions[K]["values"] };
  palette: Record<keyof typeof labPalette, string>;
};
export function resolveWorkLabConfig(value?: unknown): WorkLabConfig {
  const input = value && typeof value === "object" ? value as Record<string, any> : {};
  return {
    parameters: Object.fromEntries(Object.entries(labParameters).map(([key, def]) => {
      const n = input.parameters?.[key];
      return [key, typeof n === "number" && Number.isFinite(n) ? Math.max(def.min, Math.min(def.max, n)) : def.value];
    })) as WorkLabConfig["parameters"],
    effects: Object.fromEntries(Object.keys(labEffects).map(key => [key, input.effects?.[key] !== false])) as WorkLabConfig["effects"],
    options: Object.fromEntries(Object.entries(labOptions).map(([key, def]) => [key,
      Object.hasOwn(def.values, input.options?.[key]) ? input.options[key] : def.value,
    ])) as WorkLabConfig["options"],
    palette: Object.fromEntries(Object.entries(labPalette).map(([key, def]) => [key,
      /^#[0-9a-f]{6}$/i.test(input.palette?.[key]) ? input.palette[key] : def.value,
    ])) as WorkLabConfig["palette"],
  };
}
