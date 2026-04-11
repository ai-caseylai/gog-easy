# gog-easy

一個「Google OAuth Gateway（GOG）」：用極簡網頁讓使用者一鍵授權 Google（Gmail / Calendar / Contacts），後端安全保存 token，並提供給 OpenClaw 使用的 API（`x-api-key`）。

## 本機開發

1. 安裝依賴

```bash
npm install
```

2. 建立 `.env`

參考 `.env.example`，至少需要填：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `API_KEY_SALT`

3. 啟動

```bash
npm run dev
```

- 前端：`http://localhost:5173`
- 後端：`http://localhost:3001`

## 線上設定（Vercel）

部署後打開：`/setup`

- 上傳 Google OAuth client JSON（可自動解析 `GOOGLE_CLIENT_ID/SECRET`）
- 輸入部署網址，複製整段 env，貼到 Vercel `Environment Variables`
- 補上 `SUPABASE_SERVICE_ROLE_KEY`，並 Redeploy
- Google Cloud OAuth Client 的 Redirect URI 需加入：
  - `https://<你的網域>/api/oauth/google/callback`

## OpenClaw API（摘要）

所有請求帶 header：`x-api-key: <key>`

- `GET /v1/gmail/messages`
- `POST /v1/gmail/send`
- `GET /v1/calendar/events`
- `POST /v1/calendar/events`
- `GET /v1/contacts/search`

