import { useEffect, useMemo, useState } from 'react'
import { apiPost } from '../utils/api'

type AdminTwilioStatus = {
  configured: boolean
  accountSid?: string | null
  from?: string | null
  messagingServiceSid?: string | null
  requiresSetupToken?: boolean
}

export default function Twilio() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [setupToken, setSetupToken] = useState('')
  const [requiresToken, setRequiresToken] = useState(false)

  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [from, setFrom] = useState('')
  const [messagingServiceSid, setMessagingServiceSid] = useState('')
  const [testTo, setTestTo] = useState('')
  const [testBody, setTestBody] = useState('Your OTP system test')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setOk(null)
      try {
        const res = await fetch('/api/admin/twilio/status', {
          method: 'GET',
          credentials: 'include',
          headers: setupToken.trim() ? { 'x-setup-token': setupToken.trim() } : undefined,
        })
        const json = (await res.json()) as (AdminTwilioStatus & { success: boolean; error?: string })
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `HTTP_${res.status}`)
        }
        if (!cancelled) {
          setRequiresToken(Boolean((json as AdminTwilioStatus).requiresSetupToken))
          setAccountSid((json as AdminTwilioStatus).accountSid || '')
          setFrom((json as AdminTwilioStatus).from || '')
          setMessagingServiceSid((json as AdminTwilioStatus).messagingServiceSid || '')
        }
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
  }, [setupToken])

  const canSave = useMemo(() => {
    const hasSid = accountSid.trim().length > 0
    const hasToken = authToken.trim().length > 0
    const hasSender = from.trim().length > 0 || messagingServiceSid.trim().length > 0
    return hasSid && hasToken && hasSender
  }, [accountSid, authToken, from, messagingServiceSid])

  const canTest = useMemo(() => {
    return testTo.trim().startsWith('+') && testTo.trim().length >= 8 && testBody.trim().length > 0
  }, [testTo, testBody])

  async function save() {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      await apiPost('/api/admin/twilio/save', {
        setupToken: setupToken.trim() || undefined,
        accountSid: accountSid.trim(),
        authToken: authToken.trim(),
        from: from.trim() || null,
        messagingServiceSid: messagingServiceSid.trim() || null,
      })
      setAuthToken('')
      setOk('已儲存（Auth Token 不會再顯示）')
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaving(false)
    }
  }

  async function testSms() {
    setTesting(true)
    setError(null)
    setOk(null)
    try {
      await apiPost('/api/admin/twilio/test-sms', {
        setupToken: setupToken.trim() || undefined,
        to: testTo.trim(),
        body: testBody.trim(),
      })
      setOk('測試簡訊已送出（若是 Trial，請確保收件號碼已在 Twilio 驗證）')
    } catch (e) {
      setError(String((e as Error).message || 'ERROR'))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Twilio 設定</div>
            <div className="mt-1 text-sm text-slate-600">填入 Account SID / Auth Token / 發送者，並可直接測試發送。</div>
          </div>
          <a
            href="/setup"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            回設定精靈
          </a>
        </div>

        {loading ? <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" /> : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">輸入資料</div>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              {requiresToken ? (
                <div>
                  <div className="text-xs text-slate-600">Setup Token</div>
                  <input
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    placeholder="用於保護 Twilio 設定頁"
                    type="password"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <div className="mt-2 text-xs text-slate-500">若你尚未設定，可先在環境變數加入 `SETUP_TOKEN`，再回來填入。</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-slate-600">Account SID</div>
                <input
                  value={accountSid}
                  onChange={(e) => setAccountSid(e.target.value)}
                  placeholder="例如：ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="text-xs text-slate-600">Auth Token（只會在儲存時使用）</div>
                <input
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Twilio Auth Token"
                  type="password"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-600">發送者（擇一）</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs text-slate-600">From（建議 E.164，例如 +852... 或英數 Sender ID）</div>
                    <input
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="例如：OpenClaw 或 +1415xxxxxxx"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Messaging Service SID（選填，若你用 Messaging Service）</div>
                    <input
                      value={messagingServiceSid}
                      onChange={(e) => setMessagingServiceSid(e.target.value)}
                      placeholder="例如：MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {error ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-rose-700">{error}</div> : null}
              {ok ? <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-emerald-700">{ok}</div> : null}

              <button
                onClick={save}
                disabled={!canSave || saving}
                className={`w-full rounded-xl px-5 py-3 text-sm font-semibold ${
                  canSave && !saving ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {saving ? '儲存中…' : '儲存設定'}
              </button>
              <div className="text-xs text-slate-500">安全性：Auth Token 會在伺服器端使用 `ENCRYPTION_KEY` 加密後保存。</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">測試發送</div>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <div className="text-xs text-slate-600">收件人手機（E.164）</div>
                <input
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="例如：+85291234567"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div>
                <div className="text-xs text-slate-600">內容</div>
                <input
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <button
                onClick={testSms}
                disabled={!canTest || testing}
                className={`w-full rounded-xl px-5 py-3 text-sm font-semibold ${
                  canTest && !testing ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {testing ? '發送中…' : '發送測試簡訊'}
              </button>
              <div className="text-xs text-slate-500">Twilio Trial 可能需要先在 Twilio 後台驗證收件號碼，否則會被拒絕。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
