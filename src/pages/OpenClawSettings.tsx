import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainTabs from '../components/MainTabs'
import { apiGet, apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'

type SettingsStatus = {
  configured: boolean
  providerId: string | null
  model: string | null
  apiKeyHint: string | null
  updatedAt: string | null
}

export default function OpenClawSettings() {
  const nav = useNavigate()
  const refreshMe = useMeStore((s) => s.refresh)
  const user = useMeStore((s) => s.user)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [providerId, setProviderId] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<SettingsStatus | null>(null)

  useEffect(() => {
    void refreshMe()
  }, [refreshMe])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setOk(null)
      try {
        const res = await apiGet<SettingsStatus>('/api/openclaw/settings')
        if (cancelled) return
        setStatus(res)
        setProviderId(res.providerId || '')
        setModel(res.model || '')
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message || 'ERROR'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const canSave = useMemo(() => providerId.trim().length > 0 && apiKey.trim().length > 0, [providerId, apiKey])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const out = await apiPost<SettingsStatus>('/api/openclaw/settings', {
        providerId: providerId.trim(),
        model: model.trim() || null,
        apiKey: apiKey.trim(),
      })
      setStatus(out)
      setApiKey('')
      setOk('已儲存（API Token 不會再顯示）')
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-[560px] px-4 py-16">
          <div className="rounded-2xl border border-slate-200 bg-white p-8">
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

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-lg font-semibold">LLM 設定（OpenClaw）</div>
          <div className="mt-1 text-sm text-slate-600">每個登入用戶各自保存，不會共用。</div>

          {loading ? <div className="mt-4 h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50" /> : null}

          {status?.configured ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              目前已設定：{status.providerId || 'unknown'}{status.model ? ` / ${status.model}` : ''}
              {status.apiKeyHint ? ` / ${status.apiKeyHint}` : ''}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">目前尚未設定。</div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <div className="text-xs text-slate-600">LLM 供應商（例如 openrouter）</div>
              <input
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="例如：openrouter"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600">Model（可留空）</div>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如：gpt-4.1-mini"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600">API Token（儲存後不再顯示）</div>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={status?.apiKeyHint ? `目前已設定：${status.apiKeyHint}` : '貼上你的 token'}
                type="password"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}
          {ok ? <div className="mt-4 text-sm text-emerald-700">{ok}</div> : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void save()}
              disabled={!canSave || saving}
              className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold ${
                canSave && !saving ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
              }`}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              回控制台
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

