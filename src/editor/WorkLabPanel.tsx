import type { SiteContent } from "../../supabase/functions/_shared/schema";
import { labParameters, labOptions, labEffects, labPalette, resolveWorkLabConfig } from "../../supabase/functions/_shared/work-lab-config";
import { sendLabCommand } from "../lib/work-lab/bridge";
export function WorkLabPanel({ content, update, compact = false }: {
  content: SiteContent; update: (fn: (c: SiteContent) => void) => void; compact?: boolean;
}) {
  const config = resolveWorkLabConfig(content.workLab);
  function patch(group: keyof typeof config, key: string, value: string | number | boolean) {
    update(next => { next.workLab = resolveWorkLabConfig({ ...config, [group]: { ...config[group], [key]: value } }); });
  }
  return <details className="work-lab-author-panel" open={!compact}>
    <summary>作品場景 · 外觀與動態</summary>
    <p className="panel-help">設定與圖層、作品內容一起儲存、復原及發布。積木的「作品展示」分類可控制同一組參數。</p>
    <div className="property-grid">
      {(["browse", "detail", "inspect"] as const).map((view, i) => <button key={view} className="panel-secondary" onClick={() => {
        document.querySelectorAll<HTMLElement>('.editor-canvas [data-work-lab]').forEach(root => sendLabCommand(root, { type: "view", value: view }));
      }}>{["陣列預覽", "資料預覽", "360° 預覽"][i]}</button>)}
    </div>
    <div className="advanced-panel">
      {Object.entries(labOptions).map(([key, def]) => <label key={key}>{def.label}
        <select aria-label={def.label} value={config.options[key as keyof typeof labOptions]} onChange={e => patch("options", key, e.target.value)}>
          {Object.entries(def.values).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>)}
      <details open><summary>卡帶顏色與貼圖</summary><div className="property-grid">
        {Object.entries(labPalette).map(([key, def]) => <label key={key}>{def.label}<input type="color" aria-label={def.label} value={config.palette[key as keyof typeof labPalette]} onChange={e => patch("palette", key, e.target.value)} /></label>)}
      </div></details>
      <details open><summary>動態參數</summary><div className="property-grid">
        {Object.entries(labParameters).map(([key, def]) => <label key={key}>{def.label}<input type="number" aria-label={def.label} min={def.min} max={def.max} step={def.step} value={config.parameters[key as keyof typeof labParameters]} onChange={e => {
          if (e.target.value !== "" && Number.isFinite(e.target.valueAsNumber)) patch("parameters", key, e.target.valueAsNumber);
        }} /></label>)}
      </div></details>
      <details><summary>效果開關</summary>{Object.entries(labEffects).map(([key, label]) => <label className="check-row" key={key}><input type="checkbox" checked={config.effects[key as keyof typeof labEffects]} onChange={e => patch("effects", key, e.target.checked)} />{label}</label>)}</details>
      <button className="panel-secondary" onClick={() => update(next => { next.workLab = resolveWorkLabConfig(); })}>還原作品展示設定</button>
    </div>
  </details>;
}
