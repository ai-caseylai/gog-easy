import { useState } from 'react'

export type AdminManagedUser = {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  created_at: string
  updated_at: string
}

export function CreateAdminUserDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (input: { email: string; role: 'admin' | 'super_admin'; password: string }) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await onCreate({ email: email.trim().toLowerCase(), role, password })
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">新增管理員用戶</div>
          <div className="mt-1 text-xs text-slate-600">僅 Super Admin 可建立或修改。</div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-slate-600">Email *</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Role</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value === 'super_admin' ? 'super_admin' : 'admin')}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Password *</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="至少 8 字元"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              disabled={saving || !email.trim() || password.length < 8}
              onClick={() => void submit()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && email.trim() && password.length >= 8
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '建立中…' : '建立'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EditAdminUserDialog({
  user,
  onClose,
  onSave,
}: {
  user: AdminManagedUser
  onClose: () => void
  onSave: (input: { role?: 'admin' | 'super_admin'; password?: string }) => Promise<void>
}) {
  const [role, setRole] = useState<'admin' | 'super_admin'>(user.role)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await onSave({ role, password: password.trim() ? password : undefined })
      onClose()
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">編輯用戶</div>
          <div className="mt-1 text-xs text-slate-600">{user.email}</div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-600">Role</div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value === 'super_admin' ? 'super_admin' : 'admin')}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="admin">admin</option>
                <option value="super_admin">super_admin</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Reset Password（可選）</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="留空表示不變"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              disabled={saving || (password.length > 0 && password.length < 8)}
              onClick={() => void submit()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && !(password.length > 0 && password.length < 8)
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

