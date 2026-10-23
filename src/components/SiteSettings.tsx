import { GearIcon } from "./GearIcon";
export function SiteSettings({ dialogOnly = false, triggerOnly = false } = {}) {
  return <>
    {!dialogOnly && <button className="site-settings-button" data-site-settings aria-label="開啟全站設定"><GearIcon /><span>設定</span></button>}
    {!triggerOnly && <dialog className="site-settings-dialog experience-settings" data-site-settings-modal aria-labelledby="site-settings-title">
      <header><div><span className="settings-eyebrow">PERSONAL PREFERENCES</span><h2 id="site-settings-title">你的觀看方式</h2></div><button data-site-settings-close aria-label="關閉全站設定">×</button></header>
      <p className="settings-intro">調整光線與節奏，讓這個空間更貼近你。</p>
      <label>全站配色<select data-site-theme-select aria-label="全站配色"><option value="light">淺色</option><option value="dark">深色</option></select></label>
      <label>全站動態<select data-site-motion-select aria-label="全站動態"><option value="system">依系統設定</option><option value="full">完整動態</option><option value="reduced">減少動態</option></select></label>
      <p>配色與動態偏好會同步到所有分頁。完整動態包含頁面揭幕、影像取景與作品動畫；減少動態仍保留全部內容與操作。</p>
    </dialog>}
  </>;
}
