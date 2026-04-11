import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPost } from '@/utils/api'
import { useMeStore } from '@/stores/useMeStore'
import { Copy, KeyRound, Link2, RefreshCcw, ShieldAlert, Unlink, Mail, Calendar, Contact } from 'lucide-react'

type TabKey = 'gmail' | 'calendar' | 'contacts'

function maskKeyPrefix(prefix: string) {
  if (prefix.length <= 6) return prefix
  return `${prefix}****`
}

export default function Dashboard() {
  const nav = useNavigate()
  const { loading, error, user, google, apiKeyPrefix, refresh } = useMeStore()
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('gmail')
  const [testLoading, setTestLoading] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [testData, setTestData] = useState<unknown>(null)

  useEffect(() => {
    refresh()
  }, [refresh])

  const connected = google?.status === 'connected'

  const scopes = useMemo(() => {
    const s = google?.scopes
    return {
      gmail: Boolean(s?.gmailReadonly),
      calendar: Boolean(s?.calendarReadonly),
      contacts: Boolean(s?.contactsReadonly),
    }
  }, [google?.scopes])

  async function rotateKey() {
    const out = await apiPost<{ apiKey: { key: string; prefix: string } }>('/api/api-keys/rotate')
    setFullKey(out.apiKey.key)
    await refresh()
  }

  async function revoke() {
    await apiPost('/api/connections/google/revoke')
    setFullKey(null)
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

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-[#EAF0FF]">
        <div className="mx-auto max-w-[1040px] px-4 py-14">
          <div className="h-32 animate-pulse rounded-2xl border border-[#24324D] bg-[#111B2E]" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-[#EAF0FF]">
        <div className="mx-auto max-w-[560px] px-4 py-16">
          <div className="rounded-2xl border border-[#24324D] bg-[#111B2E] p-8">
            <div className="flex items-start gap-4">
              <ShieldAlert className="mt-1 h-6 w-6 text-[#F5A623]" />
              <div>
                <div className="text-lg font-semibold">尚未登入</div>
                <div className="mt-1 text-sm text-[#A9B7D0]">請先完成 Google 授權再回來。</div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/api/oauth/google/start"
                    className="inline-flex items-center justify-center rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#3B79F0]"
                  >
                    用 Google 授權
                  </a>
                  <button
                    onClick={() => nav('/', { replace: true })}
                    className="inline-flex items-center justify-center rounded-xl border border-[#24324D] bg-transparent px-5 py-3 text-sm font-semibold text-[#EAF0FF] hover:bg-white/5"
                  >
                    回首頁
                  </button>
                </div>
                {error ? <div className="mt-4 text-xs text-[#A9B7D0]">{error}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#EAF0FF]">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">控制台</div>
            <div className="mt-1 text-sm text-[#A9B7D0]">已連結：{user.email}</div>
          </div>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#24324D] px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            <RefreshCcw className="h-4 w-4" />
            重新整理
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#24324D] bg-[#111B2E] p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="h-4 w-4 text-[#4F8CFF]" />
              連線狀態
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                  connected ? 'bg-[#2ECC71]/15 text-[#2ECC71]' : 'bg-white/10 text-[#A9B7D0]'
                }`}
              >
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between rounded-xl border border-[#24324D] bg-black/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-[#A9B7D0]" />
                  Gmail（可讀寫）
                </div>
                <div className={`text-xs ${scopes.gmail ? 'text-[#2ECC71]' : 'text-[#A9B7D0]'}`}>{scopes.gmail ? '已啟用' : '未啟用'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#24324D] bg-black/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-[#A9B7D0]" />
                  Calendar（可讀寫）
                </div>
                <div className={`text-xs ${scopes.calendar ? 'text-[#2ECC71]' : 'text-[#A9B7D0]'}`}>{scopes.calendar ? '已啟用' : '未啟用'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#24324D] bg-black/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Contact className="h-4 w-4 text-[#A9B7D0]" />
                  Contacts（可讀寫）
                </div>
                <div className={`text-xs ${scopes.contacts ? 'text-[#2ECC71]' : 'text-[#A9B7D0]'}`}>{scopes.contacts ? '已啟用' : '未啟用'}</div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href="/api/oauth/google/start"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#3B79F0]"
              >
                <Unlink className="h-4 w-4" />
                重新授權
              </a>
              <button
                onClick={revoke}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#24324D] px-5 py-3 text-sm font-semibold hover:bg-white/5"
              >
                <Unlink className="h-4 w-4" />
                解除連線
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#24324D] bg-[#111B2E] p-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-[#4F8CFF]" />
              OpenClaw API Key
            </div>

            <div className="mt-4 rounded-xl border border-[#24324D] bg-black/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-sm text-[#EAF0FF]">
                  {apiKeyPrefix ? maskKeyPrefix(apiKeyPrefix) : '尚未建立 API Key'}
                </div>
                <button
                  onClick={async () => {
                    const value = fullKey || ''
                    if (!value) return
                    await navigator.clipboard.writeText(value)
                  }}
                  disabled={!fullKey}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                    fullKey ? 'bg-white/10 hover:bg-white/15' : 'cursor-not-allowed bg-white/5 text-[#A9B7D0]'
                  }`}
                >
                  <Copy className="h-4 w-4" />
                  複製
                </button>
              </div>
              <div className="mt-3 text-xs text-[#A9B7D0]">
                安全起見：完整 API Key 只會在「剛輪替」後顯示，請立即複製保存。
              </div>
              {fullKey ? (
                <div className="mt-4 rounded-xl border border-[#24324D] bg-[#0B1220] p-3">
                  <div className="text-xs text-[#A9B7D0]">完整 API Key（只顯示一次）</div>
                  <div className="mt-2 break-all font-mono text-sm">{fullKey}</div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={rotateKey}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#3B79F0]"
              >
                <KeyRound className="h-4 w-4" />
                輪替 API Key
              </button>
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-xl border border-[#24324D] px-5 py-3 text-sm font-semibold hover:bg-white/5"
              >
                回首頁
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-[#24324D] bg-[#111B2E] p-6 lg:col-span-2">
            <div className="mb-4 text-sm font-semibold">最小測試工具</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('gmail')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'gmail' ? 'bg-[#4F8CFF] text-[#0B1220]' : 'bg-white/10 hover:bg-white/15'}`}
              >
                Gmail
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'calendar' ? 'bg-[#4F8CFF] text-[#0B1220]' : 'bg-white/10 hover:bg-white/15'}`}
              >
                Calendar
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'contacts' ? 'bg-[#4F8CFF] text-[#0B1220]' : 'bg-white/10 hover:bg-white/15'}`}
              >
                Contacts
              </button>
              <div className="flex-1" />
              <button
                onClick={runTest}
                disabled={!connected || testLoading}
                className={`rounded-xl px-5 py-2 text-sm font-semibold ${
                  connected && !testLoading
                    ? 'bg-white/10 hover:bg-white/15'
                    : 'cursor-not-allowed bg-white/5 text-[#A9B7D0]'
                }`}
              >
                {testLoading ? '測試中…' : '測試呼叫'}
              </button>
            </div>

            {testError ? <div className="mt-4 text-sm text-[#FF5A5F]">{testError}</div> : null}
            {testData ? (
              <pre className="mt-4 max-h-[320px] overflow-auto rounded-xl border border-[#24324D] bg-[#0B1220] p-4 text-xs text-[#A9B7D0]">
                {JSON.stringify(testData, null, 2)}
              </pre>
            ) : (
              <div className="mt-4 text-sm text-[#A9B7D0]">點「測試呼叫」後會顯示結果摘要。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
