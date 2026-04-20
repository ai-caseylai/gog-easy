import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'

type Tab = {
  label: string
  to: string
  isActive: (pathname: string) => boolean
}

const tabs: Tab[] = [
  {
    label: '系統設定',
    to: '/dashboard',
    isActive: (p) => p.startsWith('/dashboard') || p.startsWith('/openclaw') || p.startsWith('/twilio') || p.startsWith('/setup'),
  },
  { label: 'VM 管理', to: '/fleet', isActive: (p) => p.startsWith('/fleet') },
  { label: '系統狀態', to: '/system-status', isActive: (p) => p.startsWith('/system-status') },
  { label: '賬單', to: '/billing', isActive: (p) => p.startsWith('/billing') },
]

export default function MainTabs() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const user = useMeStore((s) => s.user)
  const clear = useMeStore((s) => s.clear)

  async function logout() {
    await apiPost('/api/auth/phone/logout')
    clear()
    nav('/login', { replace: true })
  }

  return (
    <div className="rounded-2xl bg-white p-2 text-slate-900 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = t.isActive(pathname)
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  active
                    ? 'rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white'
                    : 'rounded-xl border border-slate-200 bg-white px-5 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50'
                }
              >
                {t.label}
              </Link>
            )
          })}
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-slate-600 sm:block">{user.phone || user.email || user.id}</div>
            <button
              onClick={() => void logout()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              登出
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
