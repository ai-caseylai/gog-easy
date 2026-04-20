import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RFB from '@novnc/novnc/lib/rfb'
import { apiPost } from '../utils/api'
import { adminApi } from '../mocks/adminApi'
import { useAdminStore } from '../stores/useAdminStore'
import AdminGuard from '../components/admin/AdminGuard'

type SessionOut = { sessionId: string }

type VmLite = {
  id: string
  name: string
  provider: string | null
  ip_address: string | null
  status: 'running' | 'stopped' | 'unknown'
  tags: string[]
  notes: string | null
}

function VncCredentialDialog({
  host,
  port,
  password,
  saving,
  error,
  onChangeHost,
  onChangePort,
  onChangePassword,
  onClose,
  onSave,
}: {
  host: string
  port: string
  password: string
  saving: boolean
  error: string | null
  onChangeHost: (v: string) => void
  onChangePort: (v: string) => void
  onChangePassword: (v: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[720px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">設定 VNC 連線資訊</div>
          <div className="mt-1 text-xs text-slate-600">第一次連線需要設定一次；密碼會加密保存，前端不讀回明文。</div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold text-slate-600">VNC Host *</div>
              <input
                value={host}
                onChange={(e) => onChangeHost(e.target.value)}
                placeholder="161.97.70.67"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">VNC Port *</div>
              <input
                value={port}
                onChange={(e) => onChangePort(e.target.value)}
                placeholder="63291"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">VNC Password *</div>
              <input
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                type="password"
                placeholder="貼上 VNC 密碼"
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
              disabled={saving || !host.trim() || !port.trim() || !password.trim()}
              onClick={onSave}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && host.trim() && port.trim() && password.trim()
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '保存中…' : '保存並連線'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminVncConsole() {
  const { id } = useParams()
  const user = useAdminStore((s) => s.user)

  const elRef = useRef<HTMLDivElement | null>(null)
  const rfbRef = useRef<RFB | null>(null)

  const [status, setStatus] = useState<'init' | 'connecting' | 'connected' | 'disconnected'>('init')
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [vmLite, setVmLite] = useState<VmLite | null>(null)
  const [needCred, setNeedCred] = useState(false)
  const [credHost, setCredHost] = useState('')
  const [credPort, setCredPort] = useState('')
  const [credPassword, setCredPassword] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const wsUrlBase = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname
    const port = window.location.port
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3002') {
      return `${proto}://${host}:3002/ws/admin/vnc`
    }
    return `${proto}://${window.location.host}/ws/admin/vnc`
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    setError(null)
    setStatus('connecting')
    setNeedsPassword(false)

    void (async () => {
      try {
        const v = await adminApi.getVm(user, id)
        const lite: VmLite = {
          id: v.id,
          name: v.name,
          provider: v.provider || null,
          ip_address: v.ip_address || null,
          status: v.status,
          tags: v.tags || [],
          notes: v.notes || null,
        }
        setVmLite(lite)
        const noteVnc = (lite.notes || '').match(/\bVNC\s*:\s*([0-9.]+)\s*:\s*(\d{2,6})\b/i)
        if (noteVnc) {
          setCredHost(noteVnc[1])
          setCredPort(noteVnc[2])
        }

        await apiPost(`/api/admin/vms/${encodeURIComponent(id)}/sync`, { vm: lite })

        let out: SessionOut
        try {
          out = await apiPost<SessionOut>('/api/admin/vnc/sessions', { vmId: id })
        } catch (e) {
          const msg = String((e as Error).message || 'ERROR')
          if (msg === 'VNC_CREDENTIAL_REQUIRED' || msg === 'VNC_HOST_PORT_REQUIRED') {
            setNeedCred(true)
            setStatus('init')
            return
          }
          throw e
        }
        if (cancelled) return

        const url = `${wsUrlBase}?sid=${encodeURIComponent(out.sessionId)}`
        const target = elRef.current
        if (!target) throw new Error('VNC_CONTAINER_MISSING')

        const rfb = new RFB(target, url, {
          shared: true,
          credentials: { password: '' },
        })
        rfbRef.current = rfb
        rfb.scaleViewport = true
        rfb.resizeSession = true

        rfb.addEventListener('connect', () => {
          setStatus('connected')
          setNeedsPassword(false)
        })

        rfb.addEventListener('disconnect', () => {
          setStatus('disconnected')
        })

        rfb.addEventListener('credentialsrequired', () => {
          setNeedsPassword(true)
        })
      } catch (e) {
        if (cancelled) return
        setStatus('disconnected')
        setError(String((e as Error).message || 'ERROR'))
      }
    })()

    return () => {
      cancelled = true
      try {
        rfbRef.current?.disconnect()
      } catch {
        void 0
      }
      rfbRef.current = null
    }
  }, [id, user, wsUrlBase, retry])

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900">
      {needCred && id && vmLite ? (
        <VncCredentialDialog
          host={credHost}
          port={credPort}
          password={credPassword}
          saving={credSaving}
          error={credError}
          onChangeHost={setCredHost}
          onChangePort={setCredPort}
          onChangePassword={setCredPassword}
          onClose={() => {
            setNeedCred(false)
            setCredPassword('')
            setCredError(null)
          }}
          onSave={() => {
            if (!id) return
            setCredSaving(true)
            setCredError(null)
            void (async () => {
              try {
                await apiPost(`/api/admin/vms/${encodeURIComponent(id)}/credentials`, {
                  vm: vmLite,
                  kind: 'vnc_password',
                  vncHost: credHost.trim(),
                  vncPort: credPort.trim(),
                  secret: credPassword,
                })
                setNeedCred(false)
                setCredPassword('')
                setRetry((x) => x + 1)
              } catch (e) {
                setCredError(String((e as Error).message || 'ERROR'))
              } finally {
                setCredSaving(false)
              }
            })()
          }}
        />
      ) : null}
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={id ? `/admin/vms/${encodeURIComponent(id)}` : '/admin?tab=vms'} className="text-sm font-semibold text-slate-700 hover:underline">
              ← 回 VM
            </Link>
            <div className="mt-2 text-xs text-slate-600">Web VNC（noVNC）</div>
          </div>
          <div className="text-xs text-slate-600">狀態：{status}</div>
        </div>

        {error ? <div className="mb-4 text-sm text-rose-700">{error}</div> : null}

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <div className="text-xs font-semibold text-slate-600">VNC Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="需要時再輸入（不會保存到前端）"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none"
              />
              {needsPassword ? <div className="mt-2 text-xs text-amber-700">需要 VNC 密碼才能繼續連線。</div> : null}
            </div>
            <button
              disabled={!needsPassword || !password.trim()}
              onClick={() => {
                const rfb = rfbRef.current
                if (!rfb) return
                try {
                  rfb.sendCredentials({ password: password.trim() })
                  setNeedsPassword(false)
                } catch {
                  void 0
                }
              }}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${
                needsPassword && password.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              送出密碼
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
          <div ref={elRef} className="h-[640px] w-full" />
        </div>
      </div>
      </div>
    </AdminGuard>
  )
}
