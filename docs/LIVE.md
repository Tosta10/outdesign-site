# OutDesign 正式環境

- 公開網站：https://tosta10.github.io/outdesign-site/
- 原始碼：https://github.com/Tosta10/outdesign-site
- CI/CD：https://github.com/Tosta10/outdesign-site/actions/workflows/deploy.yml
- 作者 API：https://lrgzjpechrhtrurfquro.supabase.co/functions/v1/studio-api
- Supabase 專案：`lrgzjpechrhtrurfquro`，免費方案，Tokyo。

網站頁尾的「作者模式」使用兩組密碼。兩組都需正確；密碼雜湊只保存在 Supabase Secrets。本機 `.local`、密碼與伺服器金鑰不在儲存庫或專案 ZIP 中。

2026-10-19 已驗證：正式 GitHub Actions 建置與 Pages 部署成功、瀏覽器雙密碼登入與編輯器載入、草稿讀取、發布版本儲存、私人附件上傳與作者讀取、匿名附件請求回傳 401。測試附件已清理，測試工作階段已登出。

## 編輯與發布

編輯器自動儲存草稿；訪客只會看到已成功部署的發布版本。完整一鍵發布需在 Supabase Edge Function Secrets 設定 `GITHUB_DISPATCH_TOKEN`，使用僅限此儲存庫、Actions 讀寫的 fine-grained token。權杖到期時需要更新此 Secret。

尚未設定發布權杖時，按「發布」仍會儲存發布版本，但會明確顯示自動部署未設定。此時可在上方 CI/CD 連結按 **Run workflow**，部署最新發布版本。不要將發布權杖加入前端環境變數或 Git。

詳細維運與密碼更新步驟見 [部署文件](DEPLOYMENT.md)。

