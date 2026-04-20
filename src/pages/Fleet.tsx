import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonitorCog, Power, RefreshCcw, RotateCcw, Search, Signal, SignalHigh, SignalLow, SignalZero, Smartphone, X } from 'lucide-react'
import MainTabs from '../components/MainTabs'
import { apiGet, apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'

type FleetNode = {
  id: string
  name: string | null
  ip: string | null
  agent: 'openclaw' | 'hermes' | null
  vmPower: 'running' | 'stopped' | 'unknown'
  heartbeatAt: string | null
  whatsapp: {
    state: 'ready' | 'needs_qr' | 'disconnected' | 'unknown'
    qrUpdatedAt: string | null
  }
}

type FleetQr = {
  qrDataUrl: string | null
  qrUpdatedAt: string | null
  whatsappState: FleetNode['whatsapp']['state']
}

type NodeAction = 'restart_agent' | 'reboot_vm' | 'start_vm' | 'stop_vm' | 'request_whatsapp_qr'

function timeAgo(iso: string | null): string {
  if (!iso) return '未知'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '未知'
  const diff = Date.now() - t
  if (diff < 45_000) return '剛剛'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins} 分鐘前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `${hrs} 小時前`
  const days = Math.floor(hrs / 24)
  return `${days} 天前`
}

function statusBadge(node: FleetNode): { label: string; cls: string; icon: JSX.Element } {
  const heartbeatAgeMs = node.heartbeatAt ? Date.now() - new Date(node.heartbeatAt).getTime() : Number.POSITIVE_INFINITY
  const online = Number.isFinite(heartbeatAgeMs) && heartbeatAgeMs < 90_000

  if (!online) {
    return {
      label: '離線',
      cls: 'bg-slate-100 text-slate-700',
      icon: <SignalZero className="h-4 w-4" />,
    }
  }

  if (node.whatsapp.state === 'needs_qr') {
    return {
      label: '待掃碼',
      cls: 'bg-amber-50 text-amber-800',
      icon: <Smartphone className="h-4 w-4" />,
    }
  }

  if (node.whatsapp.state === 'ready') {
    return {
      label: '已就緒',
      cls: 'bg-emerald-50 text-emerald-800',
      icon: <SignalHigh className="h-4 w-4" />,
    }
  }

  if (node.whatsapp.state === 'disconnected') {
    return {
      label: '已斷線',
      cls: 'bg-rose-50 text-rose-800',
      icon: <SignalLow className="h-4 w-4" />,
    }
  }

  return {
    label: '在線',
    cls: 'bg-sky-50 text-sky-800',
    icon: <Signal className="h-4 w-4" />,
  }
}

function sampleNodes(): FleetNode[] {
  const now = Date.now()
  const iso = (ms: number) => new Date(ms).toISOString()
  return [
    {
      id: 'vm-001',
      name: 'openclaw-001',
      ip: '10.10.0.11',
      agent: 'openclaw',
      vmPower: 'running',
      heartbeatAt: iso(now - 18_000),
      whatsapp: { state: 'needs_qr', qrUpdatedAt: iso(now - 30_000) },
    },
    {
      id: 'vm-002',
      name: 'openclaw-002',
      ip: '10.10.0.12',
      agent: 'openclaw',
      vmPower: 'running',
      heartbeatAt: iso(now - 6_000),
      whatsapp: { state: 'ready', qrUpdatedAt: iso(now - 300_000) },
    },
    {
      id: 'vm-003',
      name: 'openclaw-003',
      ip: '10.10.0.13',
      agent: 'openclaw',
      vmPower: 'stopped',
      heartbeatAt: null,
      whatsapp: { state: 'unknown', qrUpdatedAt: null },
    },
  ]
}

export default function Fleet() {
  const nav = useNavigate()
  const { loading, user, refresh } = useMeStore()

  const [nodes, setNodes] = useState<FleetNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingNodes, setLoadingNodes] = useState(false)

  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return nodes
    return nodes.filter((n) => {
      const hay = `${n.id} ${n.name || ''} ${n.ip || ''} ${n.agent || ''} ${n.vmPower} ${n.whatsapp.state}`.toLowerCase()
      return hay.includes(q)
    })
  }, [nodes, query])

  const [actionBusy, setActionBusy] = useState<Record<string, NodeAction | null>>({})
  const [actionMsg, setActionMsg] = useState<Record<string, string | null>>({})

  const [qrNodeId, setQrNodeId] = useState<string | null>(null)
  const [qr, setQr] = useState<FleetQr | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const qrPollRef = useRef<number | null>(null)

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function loadNodes() {
    setLoadingNodes(true)
    setError(null)
    try {
      const out = await apiGet<{ nodes: FleetNode[] }>('/api/fleet/nodes')
      setNodes(out.nodes)
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setLoadingNodes(false)
    }
  }

  useEffect(() => {
    if (!user) return
    void loadNodes()
  }, [user])

  async function runAction(nodeId: string, action: NodeAction) {
    setActionBusy((m) => ({ ...m, [nodeId]: action }))
    setActionMsg((m) => ({ ...m, [nodeId]: null }))
    try {
      await apiPost(`/api/fleet/nodes/${encodeURIComponent(nodeId)}/actions`, { action })
      setActionMsg((m) => ({ ...m, [nodeId]: '已送出' }))
      await loadNodes()
    } catch (e) {
      setActionMsg((m) => ({ ...m, [nodeId]: String((e as Error).message || 'ERROR') }))
    } finally {
      setActionBusy((m) => ({ ...m, [nodeId]: null }))
    }
  }

  const loadQrOnce = useCallback(async (nodeId: string) => {
    setQrLoading(true)
    setQrError(null)
    try {
      const out = await apiGet<FleetQr>(`/api/fleet/nodes/${encodeURIComponent(nodeId)}/whatsapp/qr`)
      setQr(out)
    } catch (e) {
      setQrError(String((e as Error).message || 'ERROR'))
    } finally {
      setQrLoading(false)
    }
  }, [])

  const stopQrPolling = useCallback(() => {
    if (qrPollRef.current) window.clearInterval(qrPollRef.current)
    qrPollRef.current = null
  }, [])

  const startQrPolling = useCallback(
    (nodeId: string) => {
      stopQrPolling()
      qrPollRef.current = window.setInterval(() => {
        void loadQrOnce(nodeId)
      }, 2500)
    },
    [loadQrOnce, stopQrPolling],
  )

  useEffect(() => {
    if (!qrNodeId) {
      stopQrPolling()
      setQr(null)
      setQrError(null)
      return
    }

    void loadQrOnce(qrNodeId)
    startQrPolling(qrNodeId)
    return () => stopQrPolling()
  }, [loadQrOnce, qrNodeId, startQrPolling, stopQrPolling])

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[1040px] px-4 py-14">
          <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[560px] px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold">尚未登入</div>
            <div className="mt-1 text-sm text-slate-600">請先用手機登入。</div>
            <div className="mt-6 flex gap-3">
              <a
                href="/login"
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                用手機登入
              </a>
              <button
                onClick={() => nav('/dashboard', { replace: true })}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                回控制台
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <MainTabs />

        <div className="mt-8 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-semibold">VM 管理</div>
            <div className="mt-1 text-sm text-slate-600">集中管理 OpenClaw 節點：狀態、QR、重啟與電源控制。</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋 id / 名稱 / IP / 狀態"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 sm:w-[280px]"
              />
            </div>
            <button
              onClick={() => void loadNodes()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              重新整理
            </button>
            <button
              onClick={() => {
                setNodes(sampleNodes())
                setError('目前尚未連上後端，已切換為示例資料')
              }}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              使用示例資料
            </button>
          </div>
        </div>

        {error ? <div className="mb-4 text-sm text-rose-700">{error}</div> : null}

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-12 gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold text-slate-600">
            <div className="col-span-4">節點</div>
            <div className="col-span-3">狀態</div>
            <div className="col-span-2">心跳</div>
            <div className="col-span-3 text-right">操作</div>
          </div>

          {loadingNodes ? (
            <div className="p-5">
              <div className="h-20 animate-pulse rounded-xl bg-slate-50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">目前沒有節點資料。</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((n) => {
                const b = statusBadge(n)
                const busy = actionBusy[n.id]
                const msg = actionMsg[n.id]
                return (
                  <div key={n.id} className="grid grid-cols-12 gap-2 px-5 py-4">
                    <div className="col-span-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700">
                          <MonitorCog className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{n.name || n.id}</div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            <span className="font-mono">{n.id}</span>
                            {n.ip ? <span className="ml-2 font-mono">{n.ip}</span> : null}
                            {n.agent ? <span className="ml-2">{n.agent}</span> : null}
                          </div>
                          {msg ? <div className="mt-1 text-xs text-slate-600">{msg}</div> : null}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-3 flex items-center">
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${b.cls}`}>
                        {b.icon}
                        {b.label}
                      </div>
                      <div className="ml-3 text-xs text-slate-600">電源：{n.vmPower === 'running' ? 'Running' : n.vmPower === 'stopped' ? 'Stopped' : 'Unknown'}</div>
                    </div>

                    <div className="col-span-2 flex items-center text-xs text-slate-600">{timeAgo(n.heartbeatAt)}</div>

                    <div className="col-span-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => setQrNodeId(n.id)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        QR
                      </button>
                      {n.vmPower === 'stopped' ? (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(n.id, 'start_vm')}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            !busy ? 'bg-sky-600 text-white hover:bg-sky-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Power className="h-4 w-4" />
                          {busy === 'start_vm' ? '啟動中…' : '啟動 VM'}
                        </button>
                      ) : n.vmPower === 'running' ? (
                        <button
                          disabled={Boolean(busy)}
                          onClick={() => void runAction(n.id, 'stop_vm')}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                            !busy ? 'bg-amber-600 text-white hover:bg-amber-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Power className="h-4 w-4" />
                          {busy === 'stop_vm' ? '關機中…' : '關機 VM'}
                        </button>
                      ) : null}
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void runAction(n.id, 'restart_agent')}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                          !busy ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {busy === 'restart_agent' ? '重啟中…' : '重啟服務'}
                      </button>
                      <button
                        disabled={Boolean(busy)}
                        onClick={() => void runAction(n.id, 'reboot_vm')}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                          !busy ? 'bg-slate-900 text-white hover:bg-slate-800' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                        }`}
                      >
                        <Power className="h-4 w-4" />
                        {busy === 'reboot_vm' ? '重開中…' : '重開 VM'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {qrNodeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-[680px] rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold">WhatsApp QR</div>
                <div className="mt-0.5 text-xs text-slate-600">
                  節點：<span className="font-mono">{qrNodeId}</span>
                  {qr?.qrUpdatedAt ? <span className="ml-2">更新：{timeAgo(qr.qrUpdatedAt)}</span> : null}
                </div>
              </div>
              <button
                onClick={() => setQrNodeId(null)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-700">
                  狀態：<span className="font-semibold">{qr?.whatsappState || 'unknown'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void loadQrOnce(qrNodeId)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    重新抓取
                  </button>
                  <button
                    onClick={() => void runAction(qrNodeId, 'request_whatsapp_qr')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <Smartphone className="h-4 w-4" />
                    重新產生
                  </button>
                </div>
              </div>

              {qrError ? <div className="mt-3 text-sm text-rose-700">{qrError}</div> : null}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {qrLoading && !qr?.qrDataUrl ? <div className="h-[280px] animate-pulse rounded-xl bg-white" /> : null}
                {qr?.qrDataUrl ? (
                  <img src={qr.qrDataUrl} alt="WhatsApp QR" className="mx-auto max-h-[360px] mix-blend-multiply" />
                ) : (
                  <div className="flex h-[280px] items-center justify-center text-sm text-slate-600">尚未收到 QR 碼</div>
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500">此視窗會每 2.5 秒自動刷新一次。</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
