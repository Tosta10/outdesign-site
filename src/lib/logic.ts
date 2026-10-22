import type {
  LogicBlock,
  LogicScript,
} from "../../supabase/functions/_shared/schema";
export type LogicOp = LogicBlock["op"];
export const logicCategories = [
  { id: "objects", name: "物件圖層", color: "#b69aff" },
  { id: "imports", name: "圖像匯入", color: "#f698c0" },
  { id: "events", name: "事件", color: "#efc356" },
  { id: "work-lab", name: "作品展示", color: "#67c9c0" },
  { id: "motion", name: "移動與變形", color: "#71a9ff" },
  { id: "looks", name: "外觀與特效", color: "#b394f8" },
  { id: "control", name: "流程控制", color: "#f5ac69" },
  { id: "data", name: "變數與判斷", color: "#79cfb0" },
] as const;
export const logicCatalog: {
  op: LogicOp;
  category: string;
  label: string;
  hint: string;
}[] = [
  { op: "lab-parameter", category: "work-lab", label: "設定作品動態參數", hint: "相機、波浪、拖曳、貼圖等 24 個參數" },
  { op: "lab-effect", category: "work-lab", label: "設定作品效果開關", hint: "14 項獨立動態效果" },
  { op: "lab-option", category: "work-lab", label: "設定作品展示選項", hint: "配色、品質、動態、音訊與玻璃" },
  { op: "lab-palette", category: "work-lab", label: "設定卡帶材質顏色", hint: "本體、框架、襯底與玻璃" },
  { op: "lab-action", category: "work-lab", label: "操作作品卡帶", hint: "切換、讀取、360°、拆解與重設" },
  { op: "move", category: "motion", label: "水平移動", hint: "以 px 移動物件" },
  { op: "move-y", category: "motion", label: "垂直移動", hint: "以 px 上下移動物件" },
  { op: "set-x", category: "motion", label: "水平位置設為", hint: "相對原始位置的 px 位移" },
  { op: "set-y", category: "motion", label: "垂直位置設為", hint: "相對原始位置的 px 位移" },
  { op: "reset-transform", category: "motion", label: "重設變形", hint: "回到腳本執行前的位置與大小" },
  { op: "text-color", category: "looks", label: "文字顏色", hint: "設定六位文字色碼" },
  { op: "radius", category: "looks", label: "圓角設為", hint: "0–500 px" },
  { op: "blur", category: "looks", label: "模糊設為", hint: "0–40 px，0 為清晰" },
  { op: "stop", category: "control", label: "停止此腳本", hint: "立即結束本次事件的後續積木" },
  { op: "rotate", category: "motion", label: "旋轉", hint: "以角度旋轉物件" },
  { op: "scale", category: "motion", label: "縮放至", hint: "100 = 原始大小" },
  { op: "opacity", category: "looks", label: "不透明度", hint: "0–100%" },
  { op: "show", category: "looks", label: "顯示物件", hint: "顯示指定圖層" },
  { op: "hide", category: "looks", label: "隱藏物件", hint: "隱藏指定圖層" },
  {
    op: "toggle",
    category: "looks",
    label: "切換顯示",
    hint: "顯示與隱藏切換",
  },
  { op: "color", category: "looks", label: "填入顏色", hint: "套用六位色碼" },
  {
    op: "text",
    category: "looks",
    label: "文字設為",
    hint: "替換文字圖層的內容",
  },
  {
    op: "animate",
    category: "looks",
    label: "播放特效",
    hint: "淡入、浮起、脈衝、搖擺",
  },
  {
    op: "link",
    category: "control",
    label: "開啟連結",
    hint: "使用 HTTPS 網址",
  },
  { op: "wait", category: "control", label: "等待", hint: "最多 5 秒" },
  {
    op: "repeat",
    category: "control",
    label: "重複執行",
    hint: "內部積木重複 1–10 次",
  },
  {
    op: "if-width",
    category: "control",
    label: "如果視窗寬度小於",
    hint: "依畫面寬度分支",
  },
  {
    op: "set-variable",
    category: "data",
    label: "變數設為",
    hint: "工作階段內的數值",
  },
  {
    op: "add-variable",
    category: "data",
    label: "變數增加",
    hint: "累加互動次數",
  },
  {
    op: "if-variable",
    category: "data",
    label: "如果變數大於等於",
    hint: "使用條件與否則分支",
  },
];
export const eventLabels: Record<LogicScript["event"], string> = {
  load: "頁面載入",
  click: "被點擊",
  hover: "游標進入",
  leave: "游標離開",
  visible: "進入可視範圍",
  key: "按下按鍵",
};
export const isContainer = (op: LogicOp) =>
  ["repeat", "if-width", "if-variable"].includes(op);
export function createLogicBlock(op: LogicOp): LogicBlock {
  return {
    id: crypto.randomUUID(),
    op,
    value: op === "lab-parameter" ? "cameraFollow" : op === "lab-effect" ? "selectionWave" : op === "lab-option" ? "theme:light" : op === "lab-palette" ? "shell:#e1dcd1" : op === "lab-action" ? "next" : ["color", "text-color"].includes(op)
        ? "#c7b8ed"
        : op === "animate"
          ? "fade"
          : op.includes("variable")
            ? "次數"
            : op === "text"
              ? "新的文字"
              : op === "link" ? "https://example.com" : "",
    amount: op === "lab-parameter" ? 24 : ["scale", "opacity"].includes(op)
        ? 100
        : op === "repeat"
          ? 3
          : op === "if-width"
            ? 768
            : ["move", "move-y"].includes(op)
              ? 24
              : 1,
    duration: 0.6,
    children: [],
    otherwise: [],
  };
}
export function findLogicBlock(
  blocks: LogicBlock[],
  id: string,
): LogicBlock | undefined {
  for (const b of blocks) {
    if (b.id === id) return b;
    const child =
      findLogicBlock(b.children, id) || findLogicBlock(b.otherwise, id);
    if (child) return child;
  }
}
export function extractLogicBlock(
  blocks: LogicBlock[],
  id: string,
): LogicBlock | undefined {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) return blocks.splice(i, 1)[0];
  for (const b of blocks) {
    const child =
      extractLogicBlock(b.children, id) || extractLogicBlock(b.otherwise, id);
    if (child) return child;
  }
}
/** Resolve the destination before extraction so same-list moves keep their order. */
export function connectLogicBlock(
  scripts: LogicScript[],
  source: { op?: LogicOp; script?: string; block?: string },
  destination: { script: string; parent: string | null; branch: "children" | "otherwise"; index: number },
) {
  const script = scripts.find((s) => s.id === destination.script);
  if (!script) return;
  const list = destination.parent
    ? findLogicBlock(script.blocks, destination.parent)?.[destination.branch]
    : script.blocks;
  if (!list) return;
  const origin = scripts.find((s) => s.id === source.script);
  const moving = origin && source.block ? findLogicBlock(origin.blocks, source.block) : undefined;
  if (moving && destination.parent && findLogicBlock([moving], destination.parent))
    throw new Error("無法將積木放入自己的內部");
  const oldIndex = list.findIndex((b) => b.id === source.block);
  const index = oldIndex >= 0 && oldIndex < destination.index ? destination.index - 1 : destination.index;
  const block = source.op ? createLogicBlock(source.op)
    : origin && source.block ? extractLogicBlock(origin.blocks, source.block) : undefined;
  if (block) list.splice(Math.min(Math.max(0, index), list.length), 0, block);
}
export function duplicateLogicScript(script: LogicScript): LogicScript {
  const next = structuredClone(script);
  next.id = crypto.randomUUID();
  next.name = `${script.name.slice(0, 55)} 副本`;
  next.x = Math.min(4000, next.x + 36);
  next.y = Math.min(4000, next.y + 36);
  const ids = (blocks: LogicBlock[]) =>
    blocks.forEach((b) => {
      b.id = crypto.randomUUID();
      ids(b.children);
      ids(b.otherwise);
    });
  ids(next.blocks);
  return next;
}
