import { useEffect, useMemo, useState } from 'react'
import MainTabs from '../components/MainTabs'
import { apiGet, apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'
import { Calendar, Contact, Link2, Mail, Unlink } from 'lucide-react'

type TabKey = 'gmail' | 'calendar' | 'contacts'

export default function SystemStatus() {
  const { google, refresh } = useMeStore()
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('gmail')
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testData, setTestData] = useState<unknown>(null)

  const connected = google?.status === 'connected'

  const scopes = useMemo(() => {
    const s = google?.scopes
    return {
      gmail: Boolean(s?.gmailReadonly),
      calendar: Boolean(s?.calendarReadonly),
      contacts: Boolean(s?.contactsReadonly),
    }
  }, [google?.scopes])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const out = await apiGet<Record<string, unknown>>('/api/health')
        if (!cancelled) setData(out)
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

  async function revoke() {
    await apiPost('/api/connections/google/revoke')
    await refresh()
  }

  async function runTest() {
    setTestLoading(true)
    setTestError(null)
    setTestData(null)
    try {
      const path = activeTab === 'gmail' ? '/api/test/gmail' : activeTab === 'calendar' ? '/api/test/calendar' : '/api/test/contacts'
      const out = await apiGet<Record<string, unknown>>(path)
      setTestData(out)
    } catch (e) {
      setTestError(String((e as Error).message || 'ERROR'))
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <MainTabs />
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-lg font-semibold">系統狀態</div>
            <div className="mt-1 text-sm text-slate-600">顯示目前後端 health 檢查結果。</div>

            {loading ? <div className="mt-4 h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50" /> : null}
            {error ? <div className="mt-4 text-sm text-rose-700">{error}</div> : null}
            {data ? (
              <pre className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(data, null, 2)}
              </pre>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-slate-700" />
              連線狀態
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-slate-500" />
                  Gmail（可讀寫）
                </div>
                <div className={`text-xs ${scopes.gmail ? 'text-emerald-700' : 'text-slate-500'}`}>{scopes.gmail ? '已啟用' : '未啟用'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Calendar（可讀寫）
                </div>
                <div className={`text-xs ${scopes.calendar ? 'text-emerald-700' : 'text-slate-500'}`}>{scopes.calendar ? '已啟用' : '未啟用'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Contact className="h-4 w-4 text-slate-500" />
                  Contacts（可讀寫）
                </div>
                <div className={`text-xs ${scopes.contacts ? 'text-emerald-700' : 'text-slate-500'}`}>{scopes.contacts ? '已啟用' : '未啟用'}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/api/oauth/google/start"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Unlink className="h-4 w-4" />
                重新授權
              </a>
              <button
                onClick={() => void revoke()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                <Unlink className="h-4 w-4" />
                解除連線
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
            <div className="mb-4 text-sm font-semibold">最小測試工具</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('gmail')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === 'gmail' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Gmail
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === 'calendar' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  activeTab === 'contacts' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Contacts
              </button>
              <div className="flex-1" />
              <button
                onClick={() => void runTest()}
                disabled={!connected || testLoading}
                className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                  connected && !testLoading
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {testLoading ? '測試中…' : '測試呼叫'}
              </button>
            </div>

            {testError ? <div className="mt-4 text-sm text-rose-700">{testError}</div> : null}
            {testData ? (
              <pre className="mt-4 max-h-[320px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(testData, null, 2)}
              </pre>
            ) : (
              <div className="mt-4 text-sm text-slate-600">點「測試呼叫」後會顯示結果摘要。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
