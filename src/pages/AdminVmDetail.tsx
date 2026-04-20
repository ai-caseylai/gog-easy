import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Monitor, Save, TerminalSquare, Trash2 } from 'lucide-react'
import AdminGuard from '../components/admin/AdminGuard'
import AdminShell from '../components/admin/AdminShell'
import { ConfirmDialog } from '../components/admin/AdminDialogs'
import { adminApi } from '../mocks/adminApi'
import type { AuditLog, VM, VMStatus } from '../mocks/adminTypes'
import { useAdminStore } from '../stores/useAdminStore'
import { apiPost } from '../utils/api'

function isoToShort(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString()
}

export default function AdminVmDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const user = useAdminStore((s) => s.user)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [vm, setVm] = useState<VM | null>(null)
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [ip, setIp] = useState('')
  const [status, setStatus] = useState<VMStatus>('unknown')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  const [sshUsername, setSshUsername] = useState('root')
  const [sshPassword, setSshPassword] = useState('')
  const [sshSaving, setSshSaving] = useState(false)
  const [sshHint, setSshHint] = useState<string | null>(null)

  const [vncHost, setVncHost] = useState('')
  const [vncPort, setVncPort] = useState('')
  const [vncPassword, setVncPassword] = useState('')
  const [vncSaving, setVncSaving] = useState(false)
  const [vncHint, setVncHint] = useState<string | null>(null)

  const canSave = useMemo(() => name.trim().length > 0 && !saving, [name, saving])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    setOk(null)
    void (async () => {
      try {
        const v = await adminApi.getVm(user, id)
        setVm(v)
        setName(v.name)
        setProvider(v.provider || '')
        setIp(v.ip_address || '')
        setStatus(v.status)
        setTags((v.tags || []).join(', '))
        setNotes(v.notes || '')
        const noteVnc = (v.notes || '').match(/\bVNC\s*:\s*([0-9.]+)\s*:\s*(\d{2,6})\b/i)
        if (noteVnc) {
          setVncHost(noteVnc[1])
          setVncPort(noteVnc[2])
        }
        const a = await adminApi.listAudit(user, { targetType: 'vm', targetId: v.id, limit: 20 })
        setAudit(a)
      } catch (e) {
        setError(String((e as Error).message || 'ERROR'))
      } finally {
        setLoading(false)
      }
    })()
  }, [id, user])

  async function save() {
    if (!id) return
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const next = await adminApi.updateVm(user, id, {
        name,
        provider,
        ip_address: ip,
        status,
        tags: tags
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        notes,
      })
      setVm(next)
      setOk('已保存')
      try {
        await apiPost(`/api/admin/vms/${encodeURIComponent(next.id)}/sync`, {
          vm: {
            id: next.id,
            name: next.name,
            provider: next.provider || null,
            ip_address: next.ip_address || null,
            status: next.status,
            tags: next.tags || [],
            notes: next.notes || null,
          },
        })
      } catch {
        void 0
      }
      const a = await adminApi.listAudit(user, { targetType: 'vm', targetId: next.id, limit: 20 })
      setAudit(a)
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminGuard>
      <AdminShell title="VM 詳情 / 編輯">
        <div>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link to="/admin?tab=vms" className="text-sm font-semibold text-slate-700 hover:underline">
                ← 回 VM 列表
              </Link>
              <div className="mt-2 text-xs text-slate-600">ID：<span className="font-mono">{id}</span></div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={!canSave}
                onClick={() => void save()}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  canSave ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
              <button
                disabled={loading || !vm}
                onClick={() => setDeleteOpen(true)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                  !loading && vm ? 'bg-rose-600 text-white hover:bg-rose-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
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

          {vm ? (
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="text-sm font-semibold">基本資訊</div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Name *</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Provider</div>
                    <input
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">IP</div>
                    <input
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Status</div>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as VMStatus)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    >
                      <option value="unknown">unknown</option>
                      <option value="running">running</option>
                      <option value="stopped">stopped</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Tags（逗號分隔）</div>
                    <input
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Notes</div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
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

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">一鍵登入（Web SSH）</div>
                    <div className="mt-1 text-xs text-slate-600">密碼只在後端加密保存，前端不會讀回明文。</div>
                  </div>
                  <Link
                    to={`/admin/vms/${encodeURIComponent(vm.id)}/ssh`}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                      vm.ip_address ? 'bg-slate-900 text-white hover:bg-slate-800' : 'pointer-events-none bg-slate-100 text-slate-400'
                    }`}
                  >
                    <TerminalSquare className="h-4 w-4" />
                    開啟 Web SSH
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">SSH Username</div>
                    <input
                      value={sshUsername}
                      onChange={(e) => setSshUsername(e.target.value)}
                      placeholder="root"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold text-slate-600">SSH Password（儲存後不再顯示）</div>
                    <input
                      value={sshPassword}
                      onChange={(e) => setSshPassword(e.target.value)}
                      type="password"
                      placeholder={sshHint ? `目前已設定：${sshHint}` : '貼上密碼後按保存'}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    {vm.ip_address ? (
                      <span>
                        目標：<span className="font-mono">{vm.ip_address}</span>
                      </span>
                    ) : (
                      <span className="text-rose-700">請先填寫 VM IP 才能連線。</span>
                    )}
                  </div>
                  <button
                    disabled={sshSaving || !vm.ip_address || !vm.name.trim() || !sshPassword.trim()}
                    onClick={() => {
                      if (!id) return
                      setSshSaving(true)
                      setError(null)
                      setOk(null)
                      void (async () => {
                        try {
                          const out = await apiPost<{ credential: { meta: { hint?: unknown } } }>(
                            `/api/admin/vms/${encodeURIComponent(id)}/credentials`,
                            {
                              vm: {
                                name: vm.name,
                                provider: vm.provider || null,
                                ip_address: vm.ip_address || null,
                                status: vm.status,
                                tags: vm.tags || [],
                                notes: vm.notes || null,
                              },
                              kind: 'ssh_password',
                              username: sshUsername.trim() || 'root',
                              secret: sshPassword,
                            },
                          )
                          const hint = typeof out.credential?.meta?.hint === 'string' ? out.credential.meta.hint : null
                          setSshHint(hint)
                          setSshPassword('')
                          setOk('SSH 密碼已保存（不會回傳明文）')
                        } catch (e) {
                          setError(String((e as Error).message || 'ERROR'))
                        } finally {
                          setSshSaving(false)
                        }
                      })()
                    }}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                      !sshSaving && vm.ip_address && vm.name.trim() && sshPassword.trim()
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'cursor-not-allowed bg-slate-100 text-slate-400'
                    }`}
                  >
                    {sshSaving ? '保存中…' : '保存 SSH 密碼'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">一鍵登入（Web VNC）</div>
                    <div className="mt-1 text-xs text-slate-600">VNC 密碼會加密保存到後端；連線時仍可能需要在網頁端輸入一次。</div>
                  </div>
                  <Link
                    to={`/admin/vms/${encodeURIComponent(vm.id)}/vnc`}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                      vncHost.trim() && vncPort.trim() ? 'bg-slate-900 text-white hover:bg-slate-800' : 'pointer-events-none bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Monitor className="h-4 w-4" />
                    開啟 Web VNC
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">VNC Host</div>
                    <input
                      value={vncHost}
                      onChange={(e) => setVncHost(e.target.value)}
                      placeholder="161.97.70.67"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">VNC Port</div>
                    <input
                      value={vncPort}
                      onChange={(e) => setVncPort(e.target.value)}
                      placeholder="63291"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">VNC Password（儲存後不再顯示）</div>
                    <input
                      value={vncPassword}
                      onChange={(e) => setVncPassword(e.target.value)}
                      type="password"
                      placeholder={vncHint ? `目前已設定：${vncHint}` : '貼上密碼後按保存'}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    {vncHost.trim() && vncPort.trim() ? (
                      <span>
                        目標：<span className="font-mono">{vncHost.trim()}:{vncPort.trim()}</span>
                      </span>
                    ) : (
                      <span className="text-rose-700">請填寫 VNC Host/Port。</span>
                    )}
                  </div>
                  <button
                    disabled={vncSaving || !vm.name.trim() || !vncHost.trim() || !vncPort.trim() || !vncPassword.trim()}
                    onClick={() => {
                      if (!id) return
                      setVncSaving(true)
                      setError(null)
                      setOk(null)
                      void (async () => {
                        try {
                          const out = await apiPost<{ credential: { meta: { hint?: unknown } } }>(
                            `/api/admin/vms/${encodeURIComponent(id)}/credentials`,
                            {
                              vm: {
                                name: vm.name,
                                provider: vm.provider || null,
                                ip_address: vm.ip_address || null,
                                status: vm.status,
                                tags: vm.tags || [],
                                notes: vm.notes || null,
                              },
                              kind: 'vnc_password',
                              vncHost: vncHost.trim(),
                              vncPort: vncPort.trim(),
                              secret: vncPassword,
                            },
                          )
                          const hint = typeof out.credential?.meta?.hint === 'string' ? out.credential.meta.hint : null
                          setVncHint(hint)
                          setVncPassword('')
                          setOk('VNC 密碼已保存（不會回傳明文）')
                        } catch (e) {
                          setError(String((e as Error).message || 'ERROR'))
                        } finally {
                          setVncSaving(false)
                        }
                      })()
                    }}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                      !vncSaving && vm.name.trim() && vncHost.trim() && vncPort.trim() && vncPassword.trim()
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'cursor-not-allowed bg-slate-100 text-slate-400'
                    }`}
                  >
                    {vncSaving ? '保存中…' : '保存 VNC 密碼'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </AdminShell>

      {deleteOpen && vm ? (
        <ConfirmDialog
          title="刪除 VM"
          description={`確定要刪除「${vm.name}」？此操作無法復原。`}
          confirmText="刪除"
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => {
            setDeleteOpen(false)
            void (async () => {
              try {
                await adminApi.deleteVm(user, vm.id)
                nav('/admin?tab=vms', { replace: true })
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
