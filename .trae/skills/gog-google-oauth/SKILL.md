---
name: "gog-google-oauth"
description: "Guides Google OAuth connection to the local GOG gateway and returns an OpenClaw API key. Invoke when user needs to authorize Google (Gmail/Calendar/Contacts) or troubleshoot auth."
---

# GOG Google OAuth（本地授權 Skill）

這個 skill 用來把使用者的 Google 帳號授權給本機的 GOG（Google OAuth Gateway），完成後取得一把給 OpenClaw（或其他客戶端）使用的 `x-api-key`。

## 什麼時候用

- 使用者說「要連 Google / 授權 Gmail / Calendar / Contacts」
- 使用者說「授權失敗 / 找不到 refresh token / 重新授權」
- 使用者說「要給 OpenClaw 用的 key / 旋轉 API Key」
- 需要檢查目前是否已連線、或測試 Gmail/Calendar/Contacts 功能

## 你需要的資訊（只問必要的）

- 目前 GOG 是否在本機跑著（預設：前端 `http://localhost:5173`，後端 `http://localhost:3001`）
- Google Cloud 的 OAuth Client 是否已建立（Web Application）
- OAuth Redirect URI 是否已加入：`http://localhost:3001/api/oauth/google/callback`

## 使用者操作（不需要碰終端機）

1) 打開 GOG 首頁：`http://localhost:5173/`
2) 按 `開始用 Google 授權`
3) 在 Google 畫面選擇帳號 → 按 `允許`
4) 授權成功會回到 `/dashboard`
5) 在控制台按 `輪替 API Key`，複製顯示的一次性 key

授權後，OpenClaw/其他客戶端只要用這把 key 呼叫 GOG 的 API 即可。

## 開發者一次性設定（Google Cloud Console）

> 這段是給「你這邊」設定用，不是給小白用。

1) Google Cloud → APIs & Services
2) 啟用：Gmail API / Google Calendar API / People API
3) OAuth consent screen
   - 若是企業內部單一 Workspace：優先選 `Internal`
4) Credentials → Create Credentials → OAuth client ID → Web application
5) Authorized redirect URIs 加入：
   - `http://localhost:3001/api/oauth/google/callback`

完成後把 `Client ID` / `Client secret` 放進 `.env`：
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 驗收方式（最短路徑）

- 在 `/dashboard` 看到狀態 `connected`
- 點控制台的測試按鈕能看到 Gmail/Calendar/Contacts 資料
- 旋轉 API Key 後，用新 key 呼叫 `/v1/*` 能成功

## 常見問題排錯

### A) 直接跳「授權失敗」

- 檢查 Google OAuth Client 的 Redirect URI 是否「完全一致」：
  - 必須是 `http://localhost:3001/api/oauth/google/callback`

### B) `no_refresh_token`

- 代表 Google 沒回 refresh token（常見於已授權過但沒強制 consent）
- 做法：在 GOG 按 `重新授權`（或解除連線後再授權一次）

### C) OpenClaw 呼叫時 `UNAUTHORIZED` / `API_KEY_INVALID`

- 確認 header 名稱是 `x-api-key`
- 確認你用的是「完整 key」，不是 dashboard 顯示的 prefix
- 若你剛輪替：舊 key 會失效，要更新 OpenClaw 端設定

## 供 OpenClaw 使用的 API（摘要）

所有請求都需帶：`x-api-key: <key>`

- Gmail
  - `GET /v1/gmail/messages`
  - `GET /v1/gmail/messages/:id`
  - `POST /v1/gmail/send`
  - `POST /v1/gmail/messages/:id/modify`
  - `POST /v1/gmail/messages/:id/trash`
  - `DELETE /v1/gmail/messages/:id`
- Calendar
  - `GET /v1/calendar/events`
  - `POST /v1/calendar/events`
  - `PATCH /v1/calendar/events/:id`
  - `DELETE /v1/calendar/events/:id`
- Contacts（People API）
  - `GET /v1/contacts/search`
  - `POST /v1/contacts`
  - `PATCH /v1/contacts?resourceName=people/...`
  - `DELETE /v1/contacts?resourceName=people/...`

