# OpenClaw 設定網站｜頁面設計規格（Desktop-first）

## Global Styles（全站）
- Layout 基礎：桌面版採「頂部導覽 + 內容容器（max-width 1200px）」；內容區以 CSS Grid（12 欄）+ 卡片式區塊；行動版改為單欄堆疊。
- Design Tokens（建議）
  - 背景：#0B1220（深色） / 卡片：#111B2E
  - 主要色：#4F8CFF；危險色：#FF4D4F；成功色：#21C55D；警示色：#F59E0B
  - 文字：主文字 #E5E7EB；次文字 #9CA3AF
  - 字級：H1 24/32、H2 18/28、Body 14/22、Mono 12/18（憑證遮罩/代碼區）
- 元件狀態
  - Button：Primary（實心）、Secondary（描邊）、Danger（紅）；hover 提升亮度、disabled 降低不透明度
  - Input：focus 顯示主色外框；錯誤狀態顯示紅色提示
  - Toast：成功/失敗/進行中（例如重啟、重裝）

---

## Page 1：登入/註冊
### Meta Information
- Title：OpenClaw 設定｜登入
- Description：登入以管理你的 LLM Provider、憑證與服務狀態。

### Page Structure
- 置中卡片（max-width 420px），背景可放淡化品牌圖形。

### Sections & Components
1. Header
   - Logo + 產品名（OpenClaw Settings）
2. Auth Card
   - Tab：登入 / 註冊
   - 表單：手機號碼（E.164）與 OTP 驗證碼（不使用 Email）
   - 提交按鈕：登入 / 建立帳號
   - 錯誤提示：表單欄位錯誤、伺服器回應錯誤
3. Footer Links
   - 次要連結：回到首頁（導向 /app，未登入則攔截）

---

## Page 2：主控台（首頁）
### Meta Information
- Title：OpenClaw 設定｜主控台
- Description：快速檢視目前 provider、服務狀態與常用入口。

### Layout
- 頂部導覽列（NavBar）+ 兩欄 Grid（主內容 8 欄、側欄 4 欄）。

### Sections & Components
1. NavBar
   - 左：Logo / 產品名
   - 中：主導覽（主控台、Provider/憑證、管理、狀態）
   - 右：使用者下拉（帳號、登出）
2. Provider Summary Card
   - 顯示：目前選用 provider（例如 OpenRouter）、最後更新時間、前往設定按鈕
3. Agents Status Cards（OpenClaw / Hermis）
   - 每張卡片：狀態徽章（Running/Stopped/Error）、簡短訊息、前往管理
4. Quick Actions（側欄）
   - 快捷按鈕：前往系統狀態、前往 skills

---

## Page 3：LLM Provider 與憑證設定
### Meta Information
- Title：OpenClaw 設定｜Provider 與憑證
- Description：選擇 LLM provider（含 OpenRouter）並管理整合憑證。

### Layout
- 上方標題 + 分段卡片（Provider / Credentials），以垂直堆疊為主。

### Sections & Components
1. Provider Selection
   - Provider 下拉/卡片列表：顯示名稱（至少 OpenRouter）
   - 儲存按鈕：儲存為預設 provider
2. Credentials Management
   - 憑證清單（Table）：名稱、遮罩值、更新時間、操作（編輯/刪除）
   - 新增/編輯彈窗（Modal）：name、secret（密碼欄位），保存後只回傳遮罩
   - Test 連線按鈕（可選）：顯示結果（成功/失敗原因）

---

## Page 4：OpenClaw/Hermis 管理（skills/重裝/重啟）
### Meta Information
- Title：OpenClaw 設定｜服務管理
- Description：管理 skills，並進行重啟/重裝等維運操作。

### Layout
- 頁首含服務切換（Tabs：OpenClaw / Hermis），下方為 Skills 與維運操作區。

### Sections & Components
1. Agent Tabs + Status Banner
   - 顯示當前 agent 狀態、最後更新、錯誤摘要（如有）
2. Skills Panel
   - 清單（Table 或 Card List）：skill 名稱、版本、狀態、操作（安裝/移除/啟用/停用）
   - 操作需顯示進行中狀態，完成後 Toast
3. Maintenance Panel（高風險操作區）
   - 重啟按鈕（Secondary）
   - 重裝按鈕（Danger）
   - 二次確認 Modal：要求輸入確認文字（例如 "REINSTALL"）+ 說明風險

---

## Page 5：系統狀態
### Meta Information
- Title：OpenClaw 設定｜系統狀態
- Description：檢視系統健康度、資源摘要與最新錯誤。

### Layout
- 三段式：健康度總覽（上）→ 指標卡片（中）→ 錯誤/事件列表（下）。

### Sections & Components
1. Overall Health Header
   - 大型狀態徽章（OK/Warn/Critical）+ 簡短說明
2. Metrics Cards
   - CPU / 記憶體 / 磁碟（若有）卡片：百分比、簡易趨勢（可先無圖）
3. Agents Status Table
   - OpenClaw/Hermis：狀態、訊息、最後更新
4. Latest Errors List
   - 列表：時間、來源、訊息；支援複製全文
