# OutDesign

深黑、少量虹彩的個人網站，附有前端區塊編輯器。作者輸入 **兩組不同的密碼**，由後端驗證後才可讀取草稿或修改內容。訪客只看到已發布版本。

![OutDesign 預覽](docs/preview.png)

## 本機開啟

需求：Node.js 24、pnpm 11。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

開啟 `http://127.0.0.1:4321/`。頁尾按「作者模式」，或按 `Alt+E`。首次使用直接在畫面設定兩組不同、至少 12 個字元的密碼。之後每次輸入這兩組密碼即可登入。關閉或重新整理頁面後需重新登入。

Windows 也可直接執行 `start.cmd`；此電腦會自動使用 Codex 已提供的 Node／pnpm 執行環境。

本機服務只綁定 loopback。設定、草稿、素材儲存在 `.local/`，已排除 Git。**沒有預設密碼，也沒有可繞過驗證的前端管理開關。**

## 已實作

- 靜態公開頁面：首頁、分類作品、作品詳情、可展開筆記、關於、音樂、附件、聯絡。
- 桌面與手機版；鍵盤導覽、原生 dialog、減少動態設定。
- 點選頁面區塊編輯；新增、移除、排序作品，管理筆記與外部連結。
- Prism／Quiet／Luminous 三種視覺組合。
- 草稿自動儲存、手動儲存、撤銷／重做、JSON 備份與匯入。
- 圖片、音樂、PDF／ZIP／TXT 上傳；圖片必要時縮至長邊 1800px 並轉 WebP。
- 明確發布、發布歷史、歷史版本載入草稿、建置失敗重試。
- 兩組密碼伺服器驗證、PBKDF2 雜湊、兩小時工作階段、登出撤銷、密碼變更使舊工作階段失效。
- 持久化登入限流；檔案 MIME／簽章／大小限制；草稿與私人素材不對訪客開放。

內建的三件作品均標示「概念示範」，聯絡信箱也明確標示為示範。請用自己的內容取代。SVG 與示範音訊是本專案原創素材。

## 發布到 GitHub Pages

完整步驟見 [部署文件](docs/DEPLOYMENT.md)。GitHub Pages 承載靜態網站；Supabase 承載驗證、草稿與檔案。

1. 建立 Supabase 專案，套用 `supabase/migrations/202610190001_studio.sql`。
2. 部署 `studio-api` Edge Function，設定兩組密碼雜湊及允許來源。
3. 將專案放到 GitHub，設定 Pages 的 Source 為 GitHub Actions。
4. 設定 `PUBLIC_API_URL`、`SITE_URL`、`BASE_PATH` 三個 Repository Variables。
5. 執行 Actions；成功後才視為上線。

可使用 `pnpm github:publish --repo outdesign-site --api https://PROJECT.supabase.co/functions/v1/studio-api` 發布至自己的空白儲存庫。工具使用隱藏輸入或環境變數提供 GitHub 憑證；不把憑證存檔或放入網址。

**尚未設定後端時，靜態建置只提供概念展示，作者入口會清楚顯示尚未連線。** 本機完整編輯功能可直接使用。

## 驗證

```sh
pnpm check
pnpm test
# Windows 使用已安裝的 Edge；Linux / CI 先執行下一行。
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
pnpm build
```

瀏覽器測試使用獨立的臨時資料庫及隨機密碼，不更動你的 `.local/`。報告與桌面、手機截圖位於 `artifacts/`。

## 專案結構

```text
src/components/         公開區塊與圖示（靜態 HTML）
src/editor/             點擊作者入口後才載入的 React 編輯器
src/styles/             視覺變數、響應式與編輯介面
supabase/functions/    共用驗證／API 與正式 Edge Function
supabase/migrations/   資料表、RLS、原子儲存與發布程序
server/                loopback 本機開發後端
scripts/               開發、驗證、密碼雜湊、GitHub 發布工具
tests/                 驗證、權限、草稿與檔案安全測試
.github/workflows/      自動驗證、建置、部署
```

更多：[視覺設計](docs/DESIGN.md) · [安全與資料流程](docs/SECURITY.md) · [部署文件](docs/DEPLOYMENT.md) · [效能檢查](docs/PERFORMANCE.md)
