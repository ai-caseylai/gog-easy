# 頁面設計規格（Desktop-first）

## 全站共用規格
### Layout
- 主要以 Flexbox + 少量 CSS Grid（卡片區塊）混用。
- Desktop（≥1024px）以置中內容欄（max-width: 1040px）呈現；Mobile（≤768px）改為單欄、按鈕全寬。
- 區塊間距採 8px baseline（8/16/24/32）。

### Meta Information（預設）
- Title: 「OpenClaw Google Connector」
- Description: 「用一鍵 Google 授權，讓 OpenClaw 安全存取 Gmail/Calendar/Contacts」
- Open Graph: og:title 同 Title、og:description 同 Description、og:type=website

### Global Styles（Design tokens）
- 背景：#0B1220（深色）
- 主要卡片：#111B2E，邊框 #24324D
- 主色（Primary）：#4F8CFF；Hover：#3B79F0；Disabled：#2A3A58
- 成功：#2ECC71；警告：#F5A623；錯誤：#FF5A5F
- 文字：主文字 #EAF0FF、次文字 #A9B7D0
- 字體：系統字體（Noto Sans TC 優先）；字階：H1 28/36、H2 20/28、Body 14/22、Caption 12/18
- 按鈕：圓角 10px；Primary 實心；Secondary 外框；Focus 顯示 2px 外框（#4F8CFF 40%）
- 連結：同 Primary，hover 下底線

### 共用元件
- Top Nav（簡化）：左側 Logo/產品名；右側僅在已授權時顯示「控制台」與「解除連線」。
- Toast：成功/失敗提示（右上角，3 秒自動消失）。
- Code Block：API Key 顯示區（等寬字體、可複製按鈕）。

---

## Page 1：首頁 / 一鍵授權頁（/）
### Meta
- Title: 「一鍵用 Google 授權 | OpenClaw Connector」
- Description: 「三步完成授權，讓 OpenClaw 只讀存取 Gmail/Calendar/Contacts」

### Page Structure
- 單欄堆疊式（Hero → 信任說明 → FAQ/排錯）。

### Sections & Components
1. Hero 區
   - H1：一鍵 Google 授權，OpenClaw 立即可用
   - 副標：說明「只讀」「最小權限」「可隨時解除」三個 badge
   - Primary CTA：`開始用 Google 授權`
   - 次要連結：`我已授權，前往控制台`
2. 你將授權的內容（信任區）
   - 3 張卡片（Gmail / Calendar / Contacts）
   - 每張卡片：用途一句話 + 權限說明（只讀）
3. 授權步驟（小白導引）
   - Stepper：1 選帳號 → 2 同意授權 → 3 複製 API Key 給 OpenClaw
4. FAQ / 排錯
   - Accordion：
     - 授權失敗怎麼辦（重試/換瀏覽器）
     - 換 Google 帳號（解除連線後重授權）
     - OpenClaw 顯示未授權（確認 API Key、輪替後需更新）

### Interaction States
- 點 CTA 後：顯示 loading spinner + 文案「正在前往 Google…」並禁用按鈕避免重複點擊。

---

## Page 2：授權處理頁（/oauth/processing）
### Meta
- Title: 「授權處理中… | OpenClaw Connector」
- Description: 「正在完成 Google 授權與安全設定」

### Page Structure
- 置中狀態卡（max-width 560px）。

### Sections & Components
1. 狀態卡
   - 標題：授權處理中 / 授權完成 / 授權失敗
   - 內容：
     - 處理中：spinner + 文案「約 3–10 秒」
     - 成功：勾勾 icon + 自動倒數 2 秒導去控制台
     - 失敗：錯誤摘要（可複製錯誤碼）+ `重試授權` + `回首頁`

### Responsive
- Mobile：卡片滿寬、按鈕垂直堆疊。

---

## Page 3：控制台（/dashboard）
### Meta
- Title: 「控制台 | OpenClaw Connector」
- Description: 「檢視連線狀態、取得給 OpenClaw 的 API Key、重新授權或解除連線」

### Page Structure
- Desktop：兩欄（左：狀態與操作；右：API Key 與測試）。
- Mobile：改為單欄由上到下。

### Sections & Components
1. 帳號與連線概覽（左上）
   - 顯示 Google 帳號 email、連線狀態 pill（Connected/Disconnected）
   - 顯示授權服務清單（Gmail/Calendar/Contacts）與狀態（綠/灰）
2. 主要操作（左下）
   - Primary：`重新授權`
   - Danger：`解除連線`
   - 提示文案：解除連線會讓 OpenClaw 無法再讀取資料
3. OpenClaw API Key（右上）
   - Code Block：`oc_live_****`（只顯示 prefix + 最後 4 碼）
   - 按鈕：`複製 API Key`（僅在建立/剛輪替時顯示完整 key；否則提示「請輪替以取得新 key」）
   - 次要按鈕：`輪替 API Key`
   - 警示：輪替後需更新 OpenClaw 設定
4. 最小測試工具（右下）
   - Tabs：Gmail / Calendar / Contacts
   - 每個 Tab 一個 `測試呼叫` 按鈕
   - 結果區：表格/清單（只顯示必要欄位，如信件主旨、活動標題、聯絡人姓名）
   - 失敗時：顯示「可能原因」提示（未授權/金鑰錯誤/Google 端暫時失敗）

### Interaction States
- 解除連線：二次確認 Modal（需輸入「解除」或勾選確認）
- 輪替 API Key：完成後顯示一次性完整 key（醒目黃底提示「只會顯示一次」）
- 測試呼叫：loading skeleton；成功/失敗以 toast 呈現
