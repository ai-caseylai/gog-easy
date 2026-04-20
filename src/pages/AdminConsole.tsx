import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Upload, Users } from 'lucide-react'
import AdminGuard from '../components/admin/AdminGuard'
import AdminShell from '../components/admin/AdminShell'
import { ConfirmDialog, CreateInventoryDialog, CreateVmDialog, ImportVmDialog } from '../components/admin/AdminDialogs'
import { InventoryTable, VmTable } from '../components/admin/AdminTables'
import AdminUsersTable from '../components/admin/AdminUsersTable'
import { CreateAdminUserDialog, EditAdminUserDialog, type AdminManagedUser } from '../components/admin/AdminUserDialogs'
import { adminApi } from '../mocks/adminApi'
import type { Inventory, VM } from '../mocks/adminTypes'
import { useAdminStore } from '../stores/useAdminStore'
import { apiGet, apiPost } from '../utils/api'

type TabKey = 'vms' | 'inventories' | 'users'

export default function AdminConsole() {
  const user = useAdminStore((s) => s.user)
  const [sp, setSp] = useSearchParams()

  const tab = (sp.get('tab') as TabKey) || 'vms'
  const [query, setQuery] = useState(sp.get('q') || '')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vms, setVms] = useState<VM[]>([])
  const [inventories, setInventories] = useState<Array<Inventory & { hostsCount: number }>>([])
  const [adminUsers, setAdminUsers] = useState<AdminManagedUser[]>([])

  const [createVmOpen, setCreateVmOpen] = useState(false)
  const [createInvOpen, setCreateInvOpen] = useState(false)
  const [importVmOpen, setImportVmOpen] = useState(false)
  const [createAdminOpen, setCreateAdminOpen] = useState(false)
  const [editAdmin, setEditAdmin] = useState<AdminManagedUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'vm' | 'inventory'; id: string; name: string } | null>(null)
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminManagedUser | null>(null)

  const title = useMemo(() => (tab === 'inventories' ? 'Inventory 管理' : tab === 'users' ? '用戶管理' : 'VM 管理'), [tab])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (tab === 'users') {
        const out = await apiGet<{ users: AdminManagedUser[] }>('/api/admin/users')
        setAdminUsers(out.users)
      } else if (tab === 'inventories') {
        const out = await adminApi.listInventories(user, query)
        setInventories(out)
      } else {
        const out = await adminApi.listVms(user, query)
        setVms(out)
      }
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setLoading(false)
    }
  }, [query, tab, user])

  useEffect(() => {
    setSp((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      if (query.trim()) next.set('q', query.trim())
      else next.delete('q')
      return next
    })
  }, [query, setSp, tab])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <AdminGuard>
      <AdminShell title={title}>
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSp({ tab: 'vms', q: query.trim() })}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === 'vms' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                VM
              </button>
              <button
                onClick={() => setSp({ tab: 'inventories', q: query.trim() })}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === 'inventories' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Inventory
              </button>
              {user?.role === 'super_admin' ? (
                <button
                  onClick={() => setSp({ tab: 'users', q: query.trim() })}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    tab === 'users' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  用戶
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 sm:w-[280px]"
                />
              </div>
              <button
                onClick={() => void load()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                重新整理
              </button>
              {tab === 'users' ? (
                <button
                  onClick={() => setCreateAdminOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Users className="h-4 w-4" />
                  新增用戶
                </button>
              ) : (
                <button
                  onClick={() => (tab === 'inventories' ? setCreateInvOpen(true) : setCreateVmOpen(true))}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  新增
                </button>
              )}
              {tab === 'vms' ? (
                <button
                  onClick={() => setImportVmOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  匯入
                </button>
              ) : null}
            </div>
          </div>

          {error ? <div className="mb-4 text-sm text-rose-700">{error}</div> : null}

          <div className="rounded-2xl border border-slate-200 bg-white">
            {loading ? <div className="p-5"><div className="h-20 animate-pulse rounded-xl bg-slate-50" /></div> : null}

            {!loading && tab === 'users' ? (
              <AdminUsersTable
                users={adminUsers}
                onEdit={(u) => setEditAdmin(u)}
                onDelete={(u) => setDeleteAdminTarget(u)}
              />
            ) : null}

            {!loading && tab === 'vms' ? (
              <VmTable
                vms={vms}
                onDelete={(id, name) => setDeleteTarget({ type: 'vm', id, name })}
              />
            ) : null}

            {!loading && tab === 'inventories' ? (
              <InventoryTable
                inventories={inventories}
                onDelete={(id, name) => setDeleteTarget({ type: 'inventory', id, name })}
              />
            ) : null}
          </div>
        </div>
      </AdminShell>

      {createVmOpen ? (
        <CreateVmDialog
          onClose={() => setCreateVmOpen(false)}
          onCreated={(vm) => {
            setVms((xs) => [vm, ...xs])
          }}
        />
      ) : null}

      {createInvOpen ? (
        <CreateInventoryDialog
          onClose={() => setCreateInvOpen(false)}
          onCreated={(inv) => {
            setInventories((xs) => [{ ...inv, hostsCount: 0 }, ...xs])
          }}
        />
      ) : null}

      {importVmOpen ? (
        <ImportVmDialog
          onClose={() => setImportVmOpen(false)}
          onImported={(vm) => {
            setVms((xs) => [vm, ...xs])
          }}
        />
      ) : null}

      {createAdminOpen ? (
        <CreateAdminUserDialog
          onClose={() => setCreateAdminOpen(false)}
          onCreate={async (input) => {
            const out = await apiPost<{ user: AdminManagedUser }>('/api/admin/users', input)
            setAdminUsers((xs) => [out.user, ...xs])
          }}
        />
      ) : null}

      {editAdmin ? (
        <EditAdminUserDialog
          user={editAdmin}
          onClose={() => setEditAdmin(null)}
          onSave={async (patch) => {
            const out = await apiPost<{ user: AdminManagedUser }>(`/api/admin/users/${encodeURIComponent(editAdmin.id)}`, patch)
            setAdminUsers((xs) => xs.map((x) => (x.id === out.user.id ? out.user : x)))
          }}
        />
      ) : null}

      {deleteAdminTarget ? (
        <ConfirmDialog
          title="刪除用戶"
          description={`確定要刪除「${deleteAdminTarget.email}」？此操作無法復原。`}
          confirmText="刪除"
          onCancel={() => setDeleteAdminTarget(null)}
          onConfirm={() => {
            const t = deleteAdminTarget
            setDeleteAdminTarget(null)
            void (async () => {
              try {
                await apiPost(`/api/admin/users/${encodeURIComponent(t.id)}/delete`)
                setAdminUsers((xs) => xs.filter((x) => x.id !== t.id))
              } catch (e) {
                setError(String((e as Error).message || 'ERROR'))
              }
            })()
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={deleteTarget.type === 'vm' ? '刪除 VM' : '刪除 Inventory'}
          description={`確定要刪除「${deleteTarget.name}」？此操作無法復原。`}
          confirmText="刪除"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const t = deleteTarget
            setDeleteTarget(null)
            void (async () => {
              try {
                if (t.type === 'vm') {
                  await adminApi.deleteVm(user, t.id)
                  setVms((xs) => xs.filter((x) => x.id !== t.id))
                } else {
                  await adminApi.deleteInventory(user, t.id)
                  setInventories((xs) => xs.filter((x) => x.id !== t.id))
                }
              } catch (e) {
                setError(String((e as Error).message || 'ERROR'))
              }
            })()
          }}
        />
      ) : null}
    </AdminGuard>
  )
}
