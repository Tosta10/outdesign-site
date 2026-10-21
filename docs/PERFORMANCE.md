# Step 5：效能與驗證報告

> 2026-10-21 作者工作區重構，首頁保留原面板，WebGL／水波及相關依賴已移除；下列 2026-10-19 Lighthouse 與初始 JavaScript 數據為舊版歷史紀錄，不能代表目前首頁。新模組與驗證方式見 [STUDIO.md](STUDIO.md)。

## 最新量測（2026-10-21）

以目前正式公開內容建置，使用 `/outdesign-site/` 路徑，在本機執行 Lighthouse 模擬手機：效能 99、Accessibility／Best Practices／SEO 各 100；LCP 約 2.11 秒、CLS 0、TBT 0ms，初始 JavaScript 約 2.9 KB gzip。作者編輯器與 React 僅在開啟作者模式後載入，已無 Three.js／Shader 分包。

99 個積木的編輯壓力測試以 120 次輸入事件量測到兩個 animation frame 的時間，未出現超過 50ms 的長任務。此為本機診斷，並非真實使用者 INP 或所有裝置幀率保證。完整數值見本次 `artifacts/editor-performance.json`。

本次已通過 32 項 Node／真實 migration SQL 測試、Astro／Deno 型別檢查與五尺寸 Playwright 回歸。公開頁及編輯器的 Axe 自動檢查均無 serious／critical 問題，瀏覽器無執行錯誤。已知依賴漏洞掃描及高可信度 Git 憑證樣式掃描未發現問題；不代表完整滲透測試。

## 歷史量測（2026-10-19）

對正式 `dist/` 靜態產物，在本機以 Lighthouse 13.5.0、Edge headless、預設模擬手機設定量測：

| 項目                | 結果                   |
| ------------------- | ---------------------- |
| Performance         | 99                     |
| Accessibility       | 100                    |
| Best Practices      | 100                    |
| SEO                 | 100                    |
| LCP                 | 約 1.80 秒             |
| CLS                 | 0                      |
| Total Blocking Time | 0 ms                   |
| 訪客初始 JavaScript | 約 2.84 KB gzip 計算值 |

這是本機實驗室結果，包含原創示範素材；不代表所有裝置、網路、後續上傳素材與正式網域均會取得相同成績。gzip 數值由產物計算，實際傳輸壓縮依託管服務而定。INP 必須在上線後用真實互動與流量評估，不能用 TBT 代替。

詳細報告由以下指令重現，輸出至 `artifacts/lighthouse.html`、`lighthouse.json`、`performance.json`：

```sh
pnpm build
pnpm perf
```

Linux／CI 請先 `pnpm exec playwright install --with-deps chromium`。Windows 使用現有 Edge。稽核伺服器支援 `BASE_PATH`；量測時使用與建置相同的路徑，正式 Pages 使用專案路徑。

## 已採用的優化

- 公開內容在建置時輸出為完整 HTML。作者編輯器、React runtime、Zod 與編輯器 CSS 在點擊作者入口後才載入。
- 訪客互動處理分類、原生 dialog、音樂與選單。首頁不載入 WebGL。傾斜採事件驅動、閒置即停止的 RAF。無全頁 Canvas。
- 封面圖片指定尺寸、固定比例、lazy loading、非同步解碼；主視覺優先載入。
- 月面背景為 73 KB WebP，輔以原創小體積 SVG；手機停用背景模糊與透視。音訊 `preload="none"`，由訪客主動播放。
- 大型上傳圖片在瀏覽器以長邊 1800px、WebP 品質 0.86 最佳化（GIF／AVIF 保留原檔）。
- 編輯器僅預先取回目前草稿引用的素材，不一次下載完整素材庫；選用其他私人素材時才讀取。
- 正式 Storage 透過短效、僅留在伺服器的簽名網址串流檔案，支援 Range，避免將整段大型音訊緩衝於 Edge 記憶體。
- 互動動態優先使用 transform、opacity；沒有捲動劫持或持續變動的大型陰影／模糊。
- 尊重 prefers-reduced-motion。視覺預設切換以 CSS variables／class 控制。
- 公開素材 immutable cache；私人素材與 API 狀態 no-store；上游素材錯誤不會被當成成功檔案快取。

## 功能與安全驗證

- 22 項 Node／PostgreSQL 測試通過：兩組密碼、錯誤登入、工作階段、登出、輪替、草稿隔離、版本衝突、素材保護、限流、URL／schema 驗證，以及正式 migration 的 RLS／原子發布程序。
- PostgreSQL 使用 PGlite 執行真實 migration SQL，重建 Supabase roles 與 bucket metadata 以驗證授權；這不取代正式 Supabase 服務整合測試。
- `astro check` 與正式 Edge Function 的 `deno check` 通過。
- Playwright 測試 320／390／768／1024／1440px，未發現水平溢出。
- 瀏覽器涵蓋五個頁面、右側抽屜、分類、詳情、音訊、雙密碼、草稿、主題、長按拖曳、方向鍵排序與復原、游標傾斜與 reduced-motion、交互切換、JSON／CSS 代碼套用與錯誤攔截、多媒體、手機編輯器、發布後順序持久化及歷史還原。
- Axe WCAG A／AA 自動檢查公開頁與編輯器，無嚴重或重大問題；自動檢查不代表完成所有人工無障礙驗收。

## 正式上線後仍需確認

目前 GitHub Pages 與 Supabase 已連線。正式 API 已驗證雙密碼登入、新版 layout 順序與 interactions／design 設定儲存／讀取，測試後已還原原有草稿。既有版本亦已驗證私人附件 401、作者讀取與自動發布成功。自訂網域仍需同步調整 CORS。

60fps 為互動目標；高更新率裝置、低階手機與使用者後續上傳的素材仍需實機 profiling，不承諾所有硬體固定幀率。

新版工作區整合驗證包含：編輯／預覽事件隔離、頁面屬性同步、巢狀面板、自由拖曳與縮放、鎖定／隱藏、子樹複製／刪除、網格切換、各面板程式碼、裝置畫布與畫布圖片的原子發布。拖曳與縮放的暫存畫面使用 transform，只有放下時寫入尺寸／座標。
