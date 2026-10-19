# 兩組密碼與資料保護

兩組密碼是兩個共享秘密，**不等同兩因素驗證**。本專案依使用需求提供兩個輸入欄位，由後端逐一驗證；沒有公開註冊與 Email 登入。

## 工作階段

- 密碼使用 PBKDF2-SHA256、600,000 次迭代、獨立 24-byte 隨機鹽。
- 兩組都驗證成功後簽發 32-byte 隨機 opaque token，伺服器只存 SHA-256 雜湊。
- Token 僅存於編輯器記憶體，不放 localStorage、sessionStorage、cookie、URL 或 Git。
- 每個保護端點都檢查伺服器工作階段、兩小時到期時間，以及對應密碼版本。
- 登出刪除工作階段；變更任一密碼雜湊後，舊工作階段不再有效。
- 正式環境使用 HTTPS。私人素材以 Authorization 取回後，使用短生命週期 Blob URL 預覽。

## 權限與草稿

- 所有資料表啟用 RLS，撤銷 anon／authenticated 的直接存取權；資料庫程序也撤銷 PUBLIC 執行權。
- Edge Function 的 service role 只存在後端。應用程式授權在共用 handler 統一執行。
- 只有 `/public` 與已發布素材能匿名讀取；`/draft`、`/history`、上傳、儲存、發布、刪除都要求有效 token。
- 草稿與發布版本分開保存，資料庫 transaction 建立不可變版本並同時標記其素材為公開。
- 跨分頁更新採 revision 比對，避免舊草稿覆蓋新內容。
- 歷史版本是已公開資料。素材一旦被發布版本引用，就保留公開狀態以維持既有版本與快取有效。若需移除曾公開的敏感資訊，另執行明確的刪除與快取清除流程。

## 限流與上傳

每 15 分鐘限制每個來源 10 次、整個網站 100 次登入嘗試。全域預算亦能限制來源標頭被變更的嘗試；計數由持久化、原子資料庫程序執行。這會在大量惡意請求時暫時限制作者登入，前台仍可瀏覽。

上傳檢查 MIME、檔頭簽章與大小；不接受 HTML、SVG 或腳本。JSON 有串流大小上限及 Zod 白名單。文字以 React 預設 escaping 輸出；不使用 `dangerouslySetInnerHTML`。連結僅接受 HTTPS，下載文件加 `nosniff` 與 attachment disposition。

## 初次設定與輪替

本機 `/setup` 只在 loopback、正確 Host／Origin、尚無密碼設定時可用；正式環境永遠不開放此端點。

`pnpm passwords` 可安全輸入兩組正式密碼，將雜湊寫入被 Git 忽略的 `.local/production-secrets.env`。設定到 Supabase Secrets 後即可生效。`--from-local` 可沿用本機密碼雜湊；`--rotate` 明確允許覆寫既有雜湊匯出檔。

## 部署驗證邊界

本機測試驗證共用 API 與授權邏輯。Supabase 專案未連線時，正式資料庫的 RLS、Storage、Edge Function 與 GitHub 權限仍須在部署後做 smoke test；不能用本機通過取代正式環境驗證。
