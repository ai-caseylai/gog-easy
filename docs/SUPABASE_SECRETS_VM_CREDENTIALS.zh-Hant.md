# Supabase Secrets（用於 VM 憑證）

本專案不建議在前端或純文字工單保存 VM 的 `root` 密碼 / VNC 密碼。

建議做法是：
- **明文憑證只在管理員操作當下出現一次**
- 後端在伺服器端加密後寫入 Supabase DB（`public.vm_credentials.secret_encrypted`）
- 前端只顯示「hint / 版本 / 更新時間」，永遠不讀回明文

## 1) Supabase Secrets 要放什麼

Supabase 的「Secrets」適合放 **伺服器端用的金鑰**（Edge Functions / Server Runtime）：
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`（32 bytes 的 base64，用於 AES-256-GCM）

> `SUPABASE_SERVICE_ROLE_KEY` 絕對不能放在前端。

### 設定位置
- Supabase Dashboard → Project Settings → Edge Functions → Secrets

或用 CLI：
```bash
supabase secrets set ENCRYPTION_KEY=... SUPABASE_SERVICE_ROLE_KEY=...
```

## 2) DB Schema（已建立）

已新增：
- `public.vms`
- `public.inventories`
- `public.inventory_hosts`
- `public.audit_logs`
- `public.vm_credentials`

其中 `public.vm_credentials` 用於保存加密後的 VM 憑證：
- `kind`: `ssh_password` / `ssh_private_key` / `vnc_password`
- `secret_encrypted`: 加密後密文
- `meta`: 只放 hint（例如 last4、username、vnc_host、updated_at），不放明文

RLS 已啟用，並預留以 `auth.jwt()->app_metadata.role`（`admin/super_admin`）進行權限控管。

## 3) 推薦的憑證策略

- SSH 優先用 `ssh_private_key`（每個 inventory 或每個環境一把 key），避免散落密碼
- 如需密碼登入：只存 `ssh_password`，並搭配定期輪換
- VNC 密碼同理，僅作救援用途，避免日常依賴

## 4) 前端顯示規則（避免洩漏）

- 僅顯示 `meta.hint`（例如 `***ME`）與 `updated_at`
- 永遠不提供「讀回明文」的 API
- 若需 Ansible 自動化使用明文：由後端在執行任務當下解密並注入（不落地到 log）

