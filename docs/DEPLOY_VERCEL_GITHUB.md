# Vercel 自動部署（GitHub）

你已經有 GitHub repo：`https://github.com/ai-caseylai/gog-easy`

本專案最簡單的「自動部署」是：把程式碼 push 到 GitHub，然後在 Vercel 的 team（`tech-for-living`）匯入 repo。之後每次 push 都會自動部署。

## 1) 把本機專案推到 GitHub repo

在專案根目錄執行（只要一次）：

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/ai-caseylai/gog-easy.git
git push -u origin main
```

注意：`.env` 不會被提交（已在 `.gitignore` / `.vercelignore` 忽略）。

## 2) 在 Vercel（tech-for-living）匯入 GitHub repo

1. 進入 `https://vercel.com/tech-for-living`
2. `Add New...` → `Project`
3. `Import Git Repository` → 選 `ai-caseylai/gog-easy`
4. `Deploy`

## 3) 設定環境變數（貼上即可）

1. 部署後打開：`/setup`
2. 上傳 Google OAuth client JSON（可自動解析 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`）
3. 在「一鍵產生 Vercel 環境變數」輸入你的部署網址（例如：`https://xxxx.vercel.app`）
4. 點「複製整段」
5. Vercel Project → `Settings` → `Environment Variables`：整段貼上
6. 補上 `SUPABASE_SERVICE_ROLE_KEY`
7. 觸發一次 `Redeploy`

## 4) Google OAuth Redirect URI（必做）

到 Google Cloud Console → OAuth Client → Authorized redirect URIs 加入：

```
https://<你的vercel網域>/api/oauth/google/callback
```

完成後回到網站點「開始用 Google 授權」。

