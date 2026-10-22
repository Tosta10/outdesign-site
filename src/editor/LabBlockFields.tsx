import type { LogicBlock } from "../../supabase/functions/_shared/schema";
import { labParameters, labEffects, labOptions, labPalette, labActions } from "../../supabase/functions/_shared/work-lab-config";
export function labBlockSummary(block: LogicBlock) {
  const [key, value] = block.value.split(":");
  if (block.op === "lab-parameter") return `${labParameters[key as keyof typeof labParameters]?.label || key} = ${block.amount}`;
  if (block.op === "lab-effect") return `${labEffects[key as keyof typeof labEffects] || key} ${block.amount ? "開" : "關"}`;
  if (block.op === "lab-action") return labActions[key as keyof typeof labActions] || key;
  return `${key}: ${value}`;
}
export function LabBlockFields({ block, change }: { block: LogicBlock; change: (patch: Partial<LogicBlock>) => void }) {
  const [key, value = ""] = block.value.split(":");
  const defs = block.op === "lab-parameter" ? labParameters : block.op === "lab-effect" ? labEffects
    : block.op === "lab-option" ? labOptions : block.op === "lab-palette" ? labPalette : labActions;
  const options = block.op === "lab-option" ? labOptions[key as keyof typeof labOptions] : undefined;
  const numeric = block.op === "lab-parameter" ? labParameters[key as keyof typeof labParameters] : undefined;
  return <>
    <label>作品展示控制項<select aria-label="作品展示控制項" value={key} onChange={e => {
      const k = e.target.value;
      if (block.op === "lab-option") change({ value: `${k}:${labOptions[k as keyof typeof labOptions].value}` });
      else if (block.op === "lab-palette") change({ value: `${k}:${labPalette[k as keyof typeof labPalette].value}` });
      else if (block.op === "lab-parameter") change({ value: k, amount: labParameters[k as keyof typeof labParameters].value });
      else change({ value: k });
    }}>{Object.entries(defs).map(([k, def]) => <option key={k} value={k}>{typeof def === "string" ? def : def.label}</option>)}</select></label>
    {numeric && <label>參數值<input aria-label="作品動態參數值" type="number" min={numeric.min} max={numeric.max} step={numeric.step} value={block.amount} onChange={e => {
      if (Number.isFinite(e.target.valueAsNumber)) change({ amount: Math.max(numeric.min, Math.min(numeric.max, e.target.valueAsNumber)) });
    }} /></label>}
    {block.op === "lab-effect" && <label>效果狀態<select aria-label="作品效果狀態" value={block.amount ? "1" : "0"} onChange={e => change({ amount: Number(e.target.value) })}><option value="1">開啟</option><option value="0">關閉</option></select></label>}
    {options && <label>選項值<select aria-label="作品展示選項值" value={value} onChange={e => change({ value: `${key}:${e.target.value}` })}>{Object.entries(options.values).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>}
    {block.op === "lab-palette" && <label>卡帶顏色<input type="color" aria-label="積木卡帶顏色" value={value} onChange={e => change({ value: `${key}:${e.target.value}` })} /></label>}
    <p>只影響此作品展示，數值會限制在安全範圍內。可接在載入、點擊或按鍵事件後。</p>
  </>;
}
