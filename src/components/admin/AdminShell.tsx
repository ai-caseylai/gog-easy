import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Server, Settings, Shield, Users } from 'lucide-react'
import { useAdminStore } from '../../stores/useAdminStore'

type NavItem = { label: string; to: string; icon: JSX.Element; isActive: (pathname: string, search: string) => boolean }

const baseItems: NavItem[] = [
  {
    label: 'VM',
    to: '/admin?tab=vms',
    icon: <Server className="h-4 w-4" />,
    isActive: (p, s) => p === '/admin' && (new URLSearchParams(s).get('tab') || 'vms') === 'vms',
  },
  {
    label: 'Inventory',
    to: '/admin?tab=inventories',
    icon: <Settings className="h-4 w-4" />,
    isActive: (p, s) => p === '/admin' && new URLSearchParams(s).get('tab') === 'inventories',
  },
]

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const user = useAdminStore((s) => s.user)
  const logout = useAdminStore((s) => s.logout)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="rounded-xl bg-slate-900 p-2 text-white">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Admin Console</div>
                <div className="text-xs text-slate-600">{user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</div>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              {(
                user?.role === 'super_admin'
                  ? [
                      ...baseItems,
                      {
                        label: '用戶',
                        to: '/admin?tab=users',
                        icon: <Users className="h-4 w-4" />,
                        isActive: (p: string, s: string) => p === '/admin' && new URLSearchParams(s).get('tab') === 'users',
                      } satisfies NavItem,
                    ]
                  : baseItems
              ).map((it) => {
                const active = it.isActive(pathname, search)
                return (
                  <Link
                    key={it.label}
                    to={it.to}
                    className={
                      active
                        ? 'flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white'
                        : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                    }
                  >
                    {it.icon}
                    {it.label}
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4">
              <button
                onClick={() => {
                  logout()
                  nav('/admin/login', { replace: true })
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                登出
              </button>
            </div>
          </div>

          <div>
            <div className="mb-4">
              <div className="text-xl font-semibold">{title}</div>
              <div className="mt-1 text-sm text-slate-600">管理 VM 與 Ansible inventory（Mock）。</div>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
