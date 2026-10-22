import { GearIcon } from "./GearIcon";
export function SiteSettings() {
  return <>
    <button className="site-settings-button" data-site-settings aria-label="開啟全站設定" title="全站設定"><GearIcon /></button>
    <dialog className="site-settings-dialog" data-site-settings-modal aria-labelledby="site-settings-title">
      <header><h2 id="site-settings-title">網站設定</h2><button data-site-settings-close aria-label="關閉全站設定">×</button></header>
      <label>全站配色<select data-site-theme-select aria-label="全站配色"><option value="light">淺色</option><option value="dark">深色</option></select></label>
      <p>配色會同步到首頁、作品、筆記、關於與資源頁。作品卡帶也會一起切換。</p>
    </dialog>
  </>;
}
