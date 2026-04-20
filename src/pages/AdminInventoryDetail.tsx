import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Save, Trash2 } from 'lucide-react'
import AdminGuard from '../components/admin/AdminGuard'
import AdminShell from '../components/admin/AdminShell'
import { ConfirmDialog } from '../components/admin/AdminDialogs'
import AdminHostDialog from '../components/admin/AdminHostDialog'
import { adminApi } from '../mocks/adminApi'
import type { AuditLog, Inventory, InventoryHost, VM } from '../mocks/adminTypes'
import { useAdminStore } from '../stores/useAdminStore'

function isoToShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString()
}

export default function AdminInventoryDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useAdminStore((s) => s.user)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [inv, setInv] = useState<Inventory | null>(null)
  const [hosts, setHosts] = useState<InventoryHost[]>([])
  const [vms, setVms] = useState<VM[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [varsText, setVarsText] = useState('{}')

  const [hostDialog, setHostDialog] = useState<{ mode: 'create' | 'edit'; host?: InventoryHost } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'inventory'; id: string; name: string }
    | { type: 'host'; id: string; name: string }
    | null
  >(null)

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    setOk(null)
    void (async () => {
      try {
        const [i, hs, vmList] = await Promise.all([
          adminApi.getInventory(user, id),
          adminApi.listHosts(user, id),
          adminApi.listVms(user, ''),
        ])
        setInv(i)
        setHosts(hs)
        setVms(vmList)
        setName(i.name)
        setDescription(i.description || '')
        setVarsText(JSON.stringify(i.vars || {}, null, 2) || '{}')
        const a = await adminApi.listAudit(user, { targetType: 'inventory', targetId: i.id, limit: 20 })
        setAudit(a)
      } catch (e) {
        setError(String((e as Error).message || 'ERROR'))
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user])

  async function saveInventory() {
    if (!id) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const vars = (varsText.trim() ? (JSON.parse(varsText) as Record<string, unknown>) : {})
      const next = await adminApi.updateInventory(user, id, { name, description, vars })
      setInv(next)
      setOk('已保存')
      const a = await adminApi.listAudit(user, { targetType: 'inventory', targetId: next.id, limit: 20 })
      setAudit(a)
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  async function refreshHosts() {
    if (!id) return
    try {
      const hs = await adminApi.listHosts(user, id)
      setHosts(hs)
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    }
  }

  return (
    <AdminGuard>
      <AdminShell title="Inventory 詳情 / 編輯">
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to="/admin?tab=inventories" className="text-sm font-semibold text-slate-700 hover:underline">
                ← 回 Inventory 列表
              </Link>
              <div className="mt-2 text-xs text-slate-600">ID：<span className="font-mono">{id}</span></div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!canSave}
                onClick={() => void saveInventory()}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  canSave ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
              <button
                disabled={loading || !inv}
                onClick={() => inv && setDeleteTarget({ type: 'inventory', id: inv.id, name: inv.name })}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  !loading && inv ? 'bg-rose-600 text-white hover:bg-rose-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                <Trash2 className="h-4 w-4" />
                刪除
              </button>
            </div>
          </div>

          {loading ? <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" /> : null}
          {error ? <div className="mb-4 text-sm text-rose-700">{error}</div> : null}
          {ok ? <div className="mb-4 text-sm text-emerald-700">{ok}</div> : null}

          {inv ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="text-sm font-semibold">基本資訊</div>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Name *</div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Description</div>
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Vars（JSON）</div>
                      <textarea
                        value={varsText}
                        onChange={(e) => setVarsText(e.target.value)}
                        rows={10}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="text-sm font-semibold">變更紀錄（最近）</div>
                  <div className="mt-4 grid gap-2">
                    {audit.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-700">
                          <span className="font-semibold">{a.action}</span>
                          <span className="ml-2 font-mono text-slate-600">{a.target_id}</span>
                        </div>
                        <div className="text-xs text-slate-600">{isoToShort(a.created_at)}</div>
                      </div>
                    ))}
                    {audit.length === 0 ? <div className="text-sm text-slate-600">尚無紀錄。</div> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Hosts</div>
                    <div className="mt-1 text-xs text-slate-600">Inventory 內的主機清單（可關聯 VM）。</div>
                  </div>
                  <button
                    onClick={() => setHostDialog({ mode: 'create' })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    新增 Host
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
                  <div className="col-span-4">hostname</div>
                  <div className="col-span-3">ansible_host</div>
                  <div className="col-span-3">vm_id</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {hosts.map((h) => (
                    <div key={h.id} className="grid grid-cols-12 gap-2 px-5 py-4">
                      <div className="col-span-4">
                        <button
                          onClick={() => setHostDialog({ mode: 'edit', host: h })}
                          className="text-left text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {h.hostname}
                        </button>
                        <div className="mt-0.5 font-mono text-xs text-slate-600">{h.id}</div>
                      </div>
                      <div className="col-span-3 flex items-center font-mono text-xs text-slate-700">{h.ansible_host || '-'}</div>
                      <div className="col-span-3 flex items-center font-mono text-xs text-slate-700">{h.vm_id || '-'}</div>
                      <div className="col-span-2 flex items-center justify-end">
                        <button
                          onClick={() => setDeleteTarget({ type: 'host', id: h.id, name: h.hostname })}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          刪除
                        </button>
                      </div>
                    </div>
                  ))}
                  {hosts.length === 0 ? <div className="p-5 text-sm text-slate-600">目前沒有 Host。</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </AdminShell>

      {hostDialog && id ? (
        <AdminHostDialog
          title={hostDialog.mode === 'create' ? '新增 Host' : '編輯 Host'}
          initial={hostDialog.host}
          vms={vms}
          onClose={() => setHostDialog(null)}
          onSave={async (input) => {
            await adminApi.upsertHost(user, id, input)
            await refreshHosts()
          }}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title={deleteTarget.type === 'inventory' ? '刪除 Inventory' : '刪除 Host'}
          description={`確定要刪除「${deleteTarget.name}」？此操作無法復原。`}
          confirmText="刪除"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const t = deleteTarget
            setDeleteTarget(null)
            void (async () => {
              try {
                if (!id) return
                if (t.type === 'inventory') {
                  await adminApi.deleteInventory(user, t.id)
                  nav('/admin?tab=inventories', { replace: true })
                } else {
                  await adminApi.deleteHost(user, id, t.id)
                  await refreshHosts()
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

