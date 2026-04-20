# 管理員(Admin)主控台—頁面設計規格（Desktop-first）

## Global Styles（全站設計 Token）
- Layout：桌面優先（≥1200px）；內容最大寬 1200–1440px；主要區塊以 Flexbox（側欄+主內容）為主，表格區塊以 CSS Grid/表格混合呈現。
- 色彩：
  - Background：#0B1220（深色底）或 #F7F8FA（淺色底，二選一一致化）
  - Primary：#2563EB
  - Danger：#DC2626
  - Border：#E5E7EB
  - Text：#111827 / Secondary #6B7280
- 字體：Noto Sans TC / system-ui；字級階層：H1 24、H2 18、Body 14、Caption 12。
- 元件：
  - Button：Primary/Secondary/Danger；hover 亮度 +5%；disabled 降透明度。
  - Input：focus 顯示 primary ring；錯誤顯示 danger 文案與邊框。
  - Table：sticky header；row hover 高亮；支援排序 icon。
- 互動與回饋：所有寫入操作（Create/Update/Delete）需 toast（成功/失敗），並在提交中顯示 loading。

---

## Page 1：管理員登入頁（/admin/login）
### Meta Information
- Title：Admin Login
- Description：管理員登入以管理 VM 與 Ansible Inventory
- Open Graph：title/description 與 title 同步；noindex（避免被搜尋）

### Page Structure
- 單欄置中卡片（Card），背景為純色或微弱漸層；卡片寬 420px。

### Sections & Components
1. 品牌區
   - Logo +「Admin Console」文字
2. 登入表單
   - Email（必填）
   - Password（必填，顯示/隱藏）
   - CTA：登入
   - 錯誤區：顯示「帳密錯誤/權限不足/伺服器錯誤」
3. 忘記密碼
   - Link：觸發密碼重設流程（成功提示「請至信箱收信」）

### Responsive
- ≤768px：卡片左右 padding 增加，字級維持 14；按鈕改滿寬。

---

## Page 2：管理主控台（/admin）
### Meta Information
- Title：Admin Console
- Description：VM 與 Ansible inventory 管理
- Open Graph：同上；noindex

### Layout
- 兩欄式：左側 Sidebar 固定寬 240px；右側主內容可捲動。
- Header（主內容頂部）固定：頁標題、搜尋、角色顯示、登出。

### Page Structure（主內容）
- Tab/Segmented Control：VM｜Inventory（預設 VM）
- Toolbar：搜尋框、篩選（狀態/標籤）、新增按鈕
- List Area：資料表格 + 分頁

### Sections & Components
1. Sidebar
   - 導覽：VM、Inventory
   - 權限導覽：若角色為 super_admin，預留「管理員/角色」（可先隱藏或顯示 disabled + 提示）
2. Header
   - 當前角色 badge（Admin / Super Admin）
   - 登出按鈕
3. VM Tab
   - Table 欄位：Name、Status、IP、Tags、UpdatedAt、Actions
   - Actions：查看/編輯、刪除（Danger）
   - Empty state：提示建立第一台 VM
4. Inventory Tab
   - Table 欄位：Name、Hosts Count、UpdatedAt、Actions
   - Actions：查看/編輯、刪除
5. 權限提示
   - 當操作被拒絕：以 toast + inline callout 顯示「你沒有執行此操作的權限」

### Responsive
- ≤1024px：Sidebar 可收合為圖示列；Toolbar 變為兩行排列；表格允許水平捲動。

---

## Page 3：資源詳情 / 編輯頁（/admin/vms/:id、/admin/inventories/:id）
### Meta Information
- Title：Resource Detail
- Description：檢視與編輯資源
- Open Graph：同上；noindex

### Layout
- 主內容採「上方摘要 + 下方分區」：摘要卡 + 表單卡 + 變更紀錄卡。

### Sections & Components
1. 頁首
   - Breadcrumb：Admin /（VM 或 Inventory）/ 名稱
   - 主要操作：編輯（切換模式）、保存、取消、刪除
2. VM 詳情/編輯
   - 表單欄位：name、provider、ip_address、status（select）、tags（chip input）、notes
   - 驗證：name 必填；ip 格式（若填）
3. Inventory 詳情/編輯
   - 基本欄位：name（必填）、description
   - Vars 編輯：JSON 編輯器（簡化版 textarea + JSON validate）
   - Hosts 管理：內嵌表格
     - 欄位：hostname（必填）、ansible_host、vm_id（可選關聯）、vars
     - 新增/編輯：使用 Drawer 或 Modal 表單
4. 刪除確認
   - 二次確認（輸入資源名稱或點選確認）
5. 變更紀錄（最近 N 筆）
   - 列表：時間、操作者、動作、目標

### Interaction States
- Save：成功 toast + 更新 updated_at；失敗顯示欄位錯誤或通用錯誤。
- Delete：成功後導回列表並刷新。
