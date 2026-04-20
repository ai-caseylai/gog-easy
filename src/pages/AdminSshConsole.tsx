import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { apiGet, apiPost } from '../utils/api'
import { adminApi } from '../mocks/adminApi'
import { useAdminStore } from '../stores/useAdminStore'
import AdminGuard from '../components/admin/AdminGuard'

type SessionOut = { sessionId: string; debug?: { authSource?: unknown; username?: unknown; passwordLen?: unknown } }

type VmLite = {
  id: string
  name: string
  provider: string | null
  ip_address: string | null
  status: 'running' | 'stopped' | 'unknown'
  tags: string[]
  notes: string | null
}

function CredentialDialog({
  username,
  password,
  saving,
  error,
  onChangeUsername,
  onChangePassword,
  onClose,
  onSave,
  onConnectOnce,
}: {
  username: string
  password: string
  saving: boolean
  error: string | null
  onChangeUsername: (v: string) => void
  onChangePassword: (v: string) => void
  onClose: () => void
  onSave: () => void
  onConnectOnce: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-sm font-semibold">設定 SSH 憑證</div>
          <div className="mt-1 text-xs text-slate-600">第一次連線需要設定一次；密碼會加密保存，前端不讀回明文。</div>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-600">Username</div>
              <input
                value={username}
                onChange={(e) => onChangeUsername(e.target.value)}
                placeholder="root"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm outline-none"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600">Password *</div>
              <input
                value={password}
                onChange={(e) => onChangePassword(e.target.value)}
                type="password"
                placeholder="貼上 SSH 密碼"
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
              disabled={saving || !password.trim()}
              onClick={onConnectOnce}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                !saving && password.trim()
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              }`}
            >
              只連線一次
            </button>
            <button
              disabled={saving || !password.trim()}
              onClick={onSave}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !saving && password.trim() ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
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

export default function AdminSshConsole() {
  const { id } = useParams()
  const user = useAdminStore((s) => s.user)

  const debug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === '1', [])

  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'init' | 'connecting' | 'connected' | 'closed'>('init')
  const [vmLite, setVmLite] = useState<VmLite | null>(null)
  const [needCred, setNeedCred] = useState(false)
  const [credUsername, setCredUsername] = useState('root')
  const [credPassword, setCredPassword] = useState('')
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [overridePassword, setOverridePassword] = useState<string | null>(null)
  const [forcePrompt, setForcePrompt] = useState(false)
  const [debugLines, setDebugLines] = useState<string[]>([])

  function dbg(line: string) {
    if (!debug) return
    const ts = new Date().toISOString()
    const full = `${ts} ${line}`
    try {
      console.warn(`[ssh-debug] ${full}`)
    } catch {
      void 0
    }
    setDebugLines((xs) => {
      const next = [...xs, `${ts} ${line}`]
      return next.length > 200 ? next.slice(next.length - 200) : next
    })
  }

  const elRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const runRef = useRef(0)

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname
    const port = window.location.port
    if ((host === 'localhost' || host === '127.0.0.1') && port && port !== '3002') {
      return `${proto}://${host}:3002/ws/admin/ssh`
    }
    return `${proto}://${window.location.host}/ws/admin/ssh`
  }, [])

  useEffect(() => {
    if (!id || !user) return

    let cancelled = false
    let localWs: WebSocket | null = null
    const runId = ++runRef.current

    const stale = () => cancelled || runId !== runRef.current
    setError(null)

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: { background: '#0b1220' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    termRef.current = term
    fitRef.current = fit

    if (elRef.current) {
      term.open(elRef.current)
      fit.fit()
    }

    function safeWrite(s: string) {
      try {
        term.write(s)
      } catch {
        void 0
      }
    }

    safeWrite('Connecting…\r\n')
    dbg(`init vmId=${String(id || '')} wsUrl=${wsUrl}`)

    function friendlyError(text: string): string {
      const t = text.trim()
      if (!t) return 'UNKNOWN_ERROR'
      if (/All configured authentication methods failed/i.test(t)) return 'SSH 認證失敗（帳密錯誤或 root 登入被禁用）'
      if (/authentication failed/i.test(t)) return 'SSH 認證失敗（帳密錯誤）'
      if (/handshake/i.test(t) && /timed/i.test(t)) return 'SSH 連線逾時（可能被防火牆擋住或主機忙碌）'
      if (/ECONNREFUSED/i.test(t)) return 'SSH 被拒絕連線（port 22 可能未開或被封鎖）'
      if (/ENOTFOUND|EAI_AGAIN/i.test(t)) return 'SSH 主機解析失敗（DNS/網路問題）'
      return t
    }

    const onResize = () => {
      const ws = wsRef.current
      const fit2 = fitRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN || !fit2) return
      try {
        fit2.fit()
        const dims = fit2.proposeDimensions()
        if (dims?.cols && dims?.rows) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      } catch {
        void 0
      }
    }
    window.addEventListener('resize', onResize)

    void (async () => {
      try {
        try {
          await apiGet('/api/admin/auth/me')
          dbg('auth/me ok')
        } catch {
          setError('UNAUTHORIZED：請先在 /admin/login 登入（避免切換 localhost/127.0.0.1 或不同 port）。')
          setStatus('closed')
          safeWrite('\r\nUNAUTHORIZED: please login at /admin/login\r\n')
          dbg('auth/me failed')
          return
        }

        if (stale()) return

        const v = await adminApi.getVm(user, id)
        dbg(`loaded vm name=${v.name} ip=${String(v.ip_address || '')}`)

        if (stale()) return
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
        await apiPost(`/api/admin/vms/${encodeURIComponent(id)}/sync`, {
          vm: {
            id: lite.id,
            name: lite.name,
            provider: lite.provider,
            ip_address: lite.ip_address,
            status: lite.status,
            tags: lite.tags,
            notes: lite.notes,
          },
        })

        if (stale()) return

        setStatus('connecting')
        dbg('request /ssh/sessions')
        let out: SessionOut
        try {
          const u = overridePassword ? (credUsername.trim() || 'root') : undefined
          const pwLen = overridePassword ? overridePassword.length : 0
          dbg(`session params username=${u || '(db)'} passwordLen=${pwLen}`)
          out = await apiPost<SessionOut>('/api/admin/ssh/sessions', {
            vmId: id,
            vm: lite,
            username: u,
            password: overridePassword || undefined,
            ssh2Debug: debug,
          })
        } catch (e) {
          const msg = String((e as Error).message || 'ERROR')
          dbg(`session failed ${msg}`)
          if (msg === 'SSH_CREDENTIAL_REQUIRED') {
            setNeedCred(true)
            setStatus('init')
            safeWrite('\r\nSSH password is required.\r\n')
            return
          }
          throw e
        }

        dbg(`session ok sid=${out.sessionId}`)
        if (out.debug) {
          const src = typeof out.debug.authSource === 'string' ? out.debug.authSource : 'unknown'
          const u = typeof out.debug.username === 'string' ? out.debug.username : 'unknown'
          const len = typeof out.debug.passwordLen === 'number' ? out.debug.passwordLen : null
          dbg(`session auth source=${src} username=${u} passwordLen=${len === null ? 'unknown' : String(len)}`)
        }

        if (stale()) return

        const ws = new WebSocket(`${wsUrl}?sid=${encodeURIComponent(out.sessionId)}`)
        localWs = ws
        wsRef.current = ws

        ws.addEventListener('open', () => {
          safeWrite('WebSocket connected. Establishing SSH…\r\n')
          dbg('ws open')
          try {
            fit.fit()
            const dims = fit.proposeDimensions()
            if (dims?.cols && dims?.rows) {
              ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
            }
          } catch {
            void 0
          }
        })

        ws.addEventListener('message', (ev) => {
          const s = typeof ev.data === 'string' ? ev.data : ''
          if (!s) return
          try {
            const msg = JSON.parse(s) as { type?: unknown; data?: unknown; error?: unknown; detail?: unknown; status?: unknown }
            if (msg.type === 'data' && typeof msg.data === 'string') {
              safeWrite(msg.data)
              return
            }
            if (msg.type === 'status' && typeof msg.status === 'string') {
              dbg(`status ${msg.status}`)
              if (msg.status === 'ws_connected') {
                return
              }
              if (msg.status === 'ssh_ready') {
                safeWrite('\x1b[32mSSH authenticated\x1b[0m. Opening shell…\r\n')
                return
              }
              if (msg.status === 'shell_ready') {
                setStatus('connected')
                safeWrite('\x1b[32mSSH ready\x1b[0m\r\n')
                return
              }
              if (msg.status === 'closing') {
                return
              }
            }
            if (msg.type === 'error') {
              const err = typeof msg.error === 'string' ? msg.error : 'ERROR'
              const detail = typeof msg.detail === 'string' ? msg.detail : ''
              const raw = detail ? `${err}: ${detail}` : err
              const text = friendlyError(raw)
              setError(text)
              safeWrite(`\r\n\x1b[31m${text}\x1b[0m\r\n`)
              dbg(`error ${raw}`)
              return
            }
          } catch {
            safeWrite(s)
          }
        })

        ws.addEventListener('close', (ev) => {
          setStatus('closed')
          const reason = (ev as CloseEvent).reason
          const code = (ev as CloseEvent).code
          const suffix = reason ? ` (${code}) ${reason}` : code ? ` (${code})` : ''
          safeWrite(`\r\n\x1b[33mDisconnected\x1b[0m${suffix}\r\n`)
          dbg(`ws close code=${code} reason=${reason}`)

          if (code === 1006) {
            setError((prev) =>
              prev || '連線非正常中斷（1006）。通常是 SSH 被遠端重置或密碼不正確/含不可見字元；請按右側「重新輸入密碼重試」。',
            )
          }
        })

        ws.addEventListener('error', () => {
          setStatus('closed')
          dbg('ws error')
        })

        term.onData((data) => {
          const w = localWs
          if (!w || w.readyState !== WebSocket.OPEN) return
          w.send(JSON.stringify({ type: 'data', data }))
        })
      } catch (e) {
        setStatus('closed')
        const msg = String((e as Error).message || 'ERROR')
        setError(msg)
        safeWrite(`\r\nError: ${msg}\r\n`)
      }
    })()

    return () => {
      cancelled = true
      window.removeEventListener('resize', onResize)
      try {
        localWs?.close(1000, 'UNMOUNT')
      } catch {
        void 0
      }
      try {
        termRef.current?.dispose()
      } catch {
        void 0
      }
    }
  }, [id, user, wsUrl, retry])

  return (
    <AdminGuard>
      <div className="min-h-screen bg-slate-50 text-slate-900">
      {((needCred || forcePrompt) && id && vmLite) ? (
        <CredentialDialog
          username={credUsername}
          password={credPassword}
          saving={credSaving}
          error={credError}
          onChangeUsername={setCredUsername}
          onChangePassword={setCredPassword}
          onClose={() => {
            setNeedCred(false)
            setForcePrompt(false)
            setCredPassword('')
            setCredError(null)
          }}
          onConnectOnce={() => {
            if (!id) return
            const pw = credPassword.trim()
            setOverridePassword(pw)
            setNeedCred(false)
            setForcePrompt(false)
            setCredPassword('')
            setRetry((x) => x + 1)
          }}
          onSave={() => {
            if (!id) return
            setCredSaving(true)
            setCredError(null)
            void (async () => {
              try {
                const pw = credPassword.trim()
                await apiPost(`/api/admin/vms/${encodeURIComponent(id)}/credentials`, {
                  vm: vmLite,
                  kind: 'ssh_password',
                  username: credUsername.trim() || 'root',
                  secret: pw,
                })
                setOverridePassword(pw)
                setCredPassword('')
                setNeedCred(false)
                setForcePrompt(false)
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
            <div className="mt-2 text-xs text-slate-600">
              Web SSH（僅後端解密憑證；前端不保存密碼）
            </div>
          </div>
          <div className="text-xs text-slate-600">狀態：{status}</div>
        </div>

        {error ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="text-sm text-rose-800">{error}</div>
            <button
              onClick={() => {
                setCredError(null)
                setCredPassword('')
                setForcePrompt(true)
              }}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
            >
              重新輸入密碼重試
            </button>
          </div>
        ) : null}

        {debug ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700">Debug</div>
              <button
                onClick={() => setDebugLines([])}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                清除
              </button>
            </div>
            <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-[11px] text-slate-800">
              {debugLines.join('\n') || '(empty)'}
            </pre>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0b1220] shadow-sm">
          <div ref={elRef} className="h-[560px] w-full" />
        </div>
      </div>
    </div>
    </AdminGuard>
  )
}
