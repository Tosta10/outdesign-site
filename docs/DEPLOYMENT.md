# Step 5：GitHub 與 Supabase 部署

## 1. 準備帳號與儲存庫

使用你自己的 GitHub 與 Supabase 帳號。正式資源與密碼不應放入聊天或 Git。

建議建立空白儲存庫 `outdesign-site`。若使用 `USERNAME.github.io` 作為儲存庫名稱，網站位於根目錄；一般專案位於 `/outdesign-site/`。公開／私人儲存庫的 Pages 可用性依 GitHub 方案而定。

## 2. 建立資料庫與私人儲存區

在 Supabase 建立專案，於 SQL Editor 執行完整檔案：

1. `supabase/migrations/202610190001_studio.sql`
2. `supabase/migrations/202610190002_workspace_media.sql`

既有專案只需執行第二個檔案，保留資料與原有函式權限，擴充自訂畫布圖片的原子發布。

也可使用 Supabase CLI：

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

這會建立草稿、發布歷史、工作階段、登入限流、素材紀錄及私人 `studio-media` bucket。所有資料表啟用 RLS；不要另外授予匿名寫入權限。

## 3. 設定兩組密碼

在本機終端機執行（輸入不顯示）：

```sh
pnpm passwords
```

若已在本機畫面設定密碼，也可以沿用同一組：

```sh
pnpm passwords --from-local
```

雜湊寫入 `.local/production-secrets.env`。此檔案已忽略 Git。將內容設定至 Supabase Dashboard → Edge Functions → Secrets，或執行：

```sh
supabase secrets set --env-file .local/production-secrets.env
```

另設定以下 Secrets（值僅為範例）：

| 名稱                    | 值                                                               |
| ----------------------- | ---------------------------------------------------------------- |
| `ALLOWED_ORIGINS`       | `https://USERNAME.github.io`，僅 origin，不含 `/outdesign-site/` |
| `GITHUB_OWNER`          | 你的 GitHub 使用者名稱                                           |
| `GITHUB_REPO`           | `outdesign-site`                                                 |
| `GITHUB_WORKFLOW`       | `deploy.yml`                                                     |
| `GITHUB_DISPATCH_TOKEN` | 限定該儲存庫、Actions: write 的 fine-grained token               |

多個允許來源以逗號分隔，例如 GitHub Pages 與你自己的 HTTPS 網域。後端會拒絕萬用字元或帶有路徑的來源。

`SUPABASE_URL` 與伺服器金鑰由 Supabase 注入；不要把 service-role／secret key 加到 `PUBLIC_` 變數。

## 4. 部署作者 API

```sh
supabase functions deploy studio-api --no-verify-jwt
```

本專案使用自訂 opaque session，所以平台 JWT 驗證關閉；**應用程式仍在每個保護端點驗證工作階段**。此設定也已寫入 `supabase/config.toml`。

API 網址如下：

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/studio-api
```

確認 `/status` 回傳 `configured: true`，`/public` 可讀，匿名 `/draft` 回傳 401。首次資料庫狀態會於作者讀取草稿時建立；沒有發布版本時公開 API 提供清楚標示的概念內容。

## 5. 發布完整專案至 GitHub

方式 A：專案提供的發布工具。

```sh
pnpm github:publish --repo outdesign-site --api https://YOUR_PROJECT_REF.supabase.co/functions/v1/studio-api
```

工具會安全提示輸入 GitHub 憑證，也可使用既有 `GITHUB_TOKEN`／`GH_TOKEN` 環境變數。它只接受你的**空白儲存庫**，不覆蓋既有專案；預設建立公開儲存庫，加入 `--private` 則建立私人儲存庫。它逐一上傳原始碼、原創素材、migration、CI/CD 與文件，不上傳 `.local`、密碼檔、node_modules 或測試產物。

初次上傳工作流程所需 GitHub 權限比日後觸發部署更廣。依使用的 token 類型設定建立儲存庫、Contents: write、Workflows: write；自動設定 Pages／Variables 另需 Pages／Variables 寫入權限。缺少後兩者時，原始碼仍能上傳，工具會列出需手動完成的設定。

方式 B：既有 Git／GitHub CLI 流程。

```sh
git init -b main
git add .
git commit -m "Build OutDesign website and author studio"
gh auth login
gh repo create outdesign-site --public --source=. --remote=origin --push
```

登入與 token 只在你自己的終端機或 GitHub 授權畫面完成。

## 6. 設定 Pages 與公開變數

Repository → Settings → Pages：Source 選 **GitHub Actions**。

Repository → Settings → Secrets and variables → Actions → **Variables**：

| 名稱             | 一般專案                     | 使用者首頁儲存庫 |
| ---------------- | ---------------------------- | ---------------- |
| `PUBLIC_API_URL` | 完整作者 API 網址            | 同左             |
| `SITE_URL`       | `https://USERNAME.github.io` | 同左             |
| `BASE_PATH`      | `/outdesign-site/`           | `/`              |

這些是公開網址，不是秘密。正式密碼雜湊與 GitHub token 保留於 Supabase Secrets。

Actions → **Validate and deploy OutDesign** → Run workflow。流程依序安裝固定 lockfile、型別檢查、安全測試、瀏覽器測試、靜態建置，再使用 GitHub Pages 官方 actions 部署。瀏覽器測試使用獨立臨時後端，不接觸正式內容。

網站網址由部署步驟回傳。**只有 Actions 的部署結果成功，才算上線完成。**

## 7. 日常發布與還原

1. 開啟公開網站 → 頁尾「作者模式」。
2. 輸入兩組密碼；編輯、上傳、切換風格。
3. 確認「所有修改已儲存」，按「發布」。
4. 後端建立版本並觸發 GitHub Actions；公開網站在部署成功後更新。
5. 若建置失敗，保留既有網站，面板提供建置連結與「重試部署」。

若 GitHub 回傳 run ID，編輯器會每 15 秒讀取狀態；未回傳時提供 Actions 紀錄連結，不會假稱部署成功。歷史版本以「載入草稿」還原，確認後再發布。

工作流程採單一 concurrency group；建置另核對內容版本，避免較舊發布覆蓋新版本。若後端無法讀取內容，建置失敗，保留已部署網站。

## 8. 自訂網域、備份與輪替

自訂網域時，在 Pages 設定網域與 DNS，將 `SITE_URL` 改為正式 origin、`BASE_PATH` 改為 `/`，並同步更新 `ALLOWED_ORIGINS`。可依 GitHub 文件加上 `public/CNAME`。

定期匯出編輯器 JSON；素材與資料庫另使用 Supabase 的備份／下載方式。JSON 僅含參照，不含檔案本體。音樂流量、資料庫與 Actions 額度依實際使用與方案計算。

輪替密碼：`pnpm passwords --rotate` 產生新雜湊，重新設定 Supabase Secrets；舊 token 隨即失效。遺失密碼時由 Supabase 專案擁有人重設兩個雜湊，不提供公開重設入口。

參考：[Astro Pages 部署](https://docs.astro.build/en/guides/deploy/github/) · [GitHub Actions Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)
