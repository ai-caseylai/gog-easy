import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useAdminStore } from '../stores/useAdminStore'
import { adminApi } from '../mocks/adminApi'

export default function AdminLogin() {
  const nav = useNavigate()
  const loc = useLocation()
  const { user, loading, error, login, hydrate } = useAdminStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const accounts = useMemo(() => adminApi.getMockAccounts(), [])
  const from = (loc.state as { from?: string } | null)?.from

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (user) nav(from || '/admin', { replace: true })
  }, [from, nav, user])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[560px] px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-slate-900 p-3 text-white">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-semibold">Admin Console</div>
              <div className="mt-1 text-sm text-slate-600">獨立於用戶介面，用於管理 VM 與 Inventory。</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div>
              <div className="text-xs font-semibold text-slate-600">Email</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-600">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="admin123"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            {error ? <div className="text-sm text-rose-700">{error}</div> : null}

            <button
              disabled={loading || !email.trim() || !password.trim()}
              onClick={() => void login(email, password)}
              className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold ${
                !loading && email.trim() && password.trim()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {loading ? '登入中…' : '登入'}
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-600">Mock 帳號</div>
            <div className="mt-3 grid gap-2">
              {accounts.map((a) => (
                <button
                  key={a.email}
                  onClick={() => {
                    setEmail(a.email)
                    setPassword(a.passwordHint)
                  }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-semibold">{a.email}</div>
                    <div className="mt-0.5 text-xs text-slate-600">{a.role === 'super_admin' ? 'Super Admin' : 'Admin'}</div>
                  </div>
                  <div className="text-xs text-slate-500">點選填入</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

