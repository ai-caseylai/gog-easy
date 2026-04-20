import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCcw, ShieldAlert } from 'lucide-react'
import MainTabs from '../components/MainTabs'
import GoogleOAuthSetupInline from '../components/GoogleOAuthSetupInline'
import { apiGet, apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'

type ProfileData = {
  agentType: 'openclaw' | 'hermes' | null
  whatsappQrDataUrl: string | null
  telegramTokenHint: string | null
  updatedAt: string | null
}

type OpenClawStatus = {
  configured: boolean
  providerId: string | null
  model: string | null
  apiKeyHint: string | null
  providerId2: string | null
  model2: string | null
  apiKeyHint2: string | null
  updatedAt: string | null
}

export default function Dashboard() {
  const nav = useNavigate()
  const { loading, error, user, refresh } = useMeStore()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [openclaw, setOpenclaw] = useState<OpenClawStatus | null>(null)
  const [extrasError, setExtrasError] = useState<string | null>(null)

  const [saveState, setSaveState] = useState({
    savingAgent: false,
    savingTelegram: false,
  })

  const [telegramToken, setTelegramToken] = useState('')
  const [whatsappQrPreview, setWhatsappQrPreview] = useState<string | null>(null)

  const [llmProviderId, setLlmProviderId] = useState('openrouter')
  const [llmModel, setLlmModel] = useState('z-ai/glm-4.5-air:free')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llm2ProviderId, setLlm2ProviderId] = useState('openrouter')
  const [llm2Model, setLlm2Model] = useState('nvidia/nemotron-3-super-120b-a12b:free')
  const [llm2ApiKey, setLlm2ApiKey] = useState('')
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const llmInitRef = useRef(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const providerOptions: { id: string; label: string }[] = [
    { id: 'openrouter', label: 'OpenRouter' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic Claude' },
    { id: 'gemini', label: 'Google Gemini' },
  ]

  const modelSuggestions: Record<string, string[]> = {
    openrouter: ['z-ai/glm-4.5-air:free', 'nvidia/nemotron-3-super-120b-a12b:free', 'openai/gpt-4.1-mini', 'openai/gpt-4.1', 'anthropic/claude-3.7-sonnet', 'google/gemini-2.0-flash'],
    openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
    anthropic: ['claude-3-7-sonnet-latest', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
    gemini: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-flash'],
  }

  async function saveLlm() {
    setLlmSaving(true)
    setLlmError(null)
    try {
      const out = await apiPost<OpenClawStatus>('/api/openclaw/settings', {
        providerId: llmProviderId.trim(),
        model: llmModel.trim() || null,
        apiKey: llmApiKey.trim(),
        providerId2: llm2ProviderId.trim() || null,
        model2: llm2Model.trim() || null,
        apiKey2: llm2ApiKey.trim() || undefined,
      })
      setOpenclaw(out)
      setLlmApiKey('')
      setLlm2ApiKey('')
    } catch (e) {
      setLlmError(String((e as Error).message || 'ERROR'))
    } finally {
      setLlmSaving(false)
    }
  }


  useEffect(() => {
    let cancelled = false
    async function loadExtras() {
      if (!user) return
      setExtrasError(null)
      try {
        const [p, o] = await Promise.all([
          apiGet<{ data: ProfileData }>('/api/profile'),
          apiGet<OpenClawStatus>('/api/openclaw/settings'),
        ])
        if (cancelled) return
        setProfile(p.data)
        setOpenclaw(o)
        setWhatsappQrPreview(p.data.whatsappQrDataUrl)
        if (!llmInitRef.current) {
          setLlmProviderId(o.providerId || 'openrouter')
          setLlmModel(o.model || 'z-ai/glm-4.5-air:free')
          setLlm2ProviderId(o.providerId2 || 'openrouter')
          setLlm2Model(o.model2 || 'nvidia/nemotron-3-super-120b-a12b:free')
          llmInitRef.current = true
        }
      } catch (e) {
        if (!cancelled) setExtrasError(String((e as Error).message || 'ERROR'))
      }
    }
    void loadExtras()
    return () => {
      cancelled = true
    }
  }, [user])


  async function saveAgentType(next: 'openclaw' | 'hermes') {
    setSaveState((s) => ({ ...s, savingAgent: true }))
    setExtrasError(null)
    try {
      const out = await apiPost<{ data: ProfileData }>('/api/profile', { agentType: next })
      setProfile(out.data)
    } catch (e) {
      setExtrasError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaveState((s) => ({ ...s, savingAgent: false }))
    }
  }

  async function saveTelegram() {
    setSaveState((s) => ({ ...s, savingTelegram: true }))
    setExtrasError(null)
    try {
      const out = await apiPost<{ data: ProfileData }>('/api/profile', { telegramToken: telegramToken.trim() })
      setProfile(out.data)
      setTelegramToken('')
    } catch (e) {
      setExtrasError(String((e as Error).message || 'ERROR'))
    } finally {
      setSaveState((s) => ({ ...s, savingTelegram: false }))
    }
  }

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
            <div className="flex items-start gap-4">
              <ShieldAlert className="mt-1 h-6 w-6 text-amber-600" />
              <div>
                <div className="text-lg font-semibold">尚未登入</div>
                <div className="mt-1 text-sm text-slate-600">請先用手機登入。</div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    用手機登入
                  </a>
                  <button
                    onClick={() => nav('/', { replace: true })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    回首頁
                  </button>
                </div>
                {error ? <div className="mt-4 text-xs text-slate-600">{error}</div> : null}
              </div>
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

        <div className="mt-8 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold">控制台</div>
            <div className="mt-1 text-sm text-slate-600">已登入：{user.phone || user.email || user.id}</div>
          </div>
          <button
            onClick={() => void refresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            重新整理
          </button>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold">簡易設定菜單</div>
          <div className="mt-1 text-base text-slate-600">照順序做完，你的智能體就能正常運作。</div>

          {extrasError ? <div className="mt-4 text-sm text-rose-700">{extrasError}</div> : null}

          <div className="mt-5 grid grid-cols-1 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-base font-semibold">1. LLM AI 設定（首選 + 次選模型）</div>
              <div className="mt-1 text-sm text-slate-500">每個登入用戶各自保存。API key 儲存後不再顯示。</div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">首選模型</div>
                <div className="mt-1 text-xs text-slate-500">
                  狀態：
                  {openclaw?.configured ? (
                    <span>
                      已設定（{openclaw.providerId || 'openrouter'}{openclaw.model ? ` / ${openclaw.model}` : ''}
                      {openclaw.apiKeyHint ? ` / ${openclaw.apiKeyHint}` : ''}）
                    </span>
                  ) : (
                    <span>尚未設定</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-slate-600">供應商</div>
                    <select
                      value={llmProviderId}
                      onChange={(e) => {
                        setLlmProviderId(e.target.value)
                        setLlmModel('')
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none"
                    >
                      {providerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">模型名</div>
                    <input
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      list="llm-model-suggestions"
                      placeholder="例如：z-ai/glm-4.5-air:free"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <datalist id="llm-model-suggestions">
                      {(modelSuggestions[llmProviderId] || []).map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">API key（儲存後不再顯示）</div>
                    <input
                      value={llmApiKey}
                      onChange={(e) => setLlmApiKey(e.target.value)}
                      type="password"
                      placeholder={openclaw?.apiKeyHint ? `目前已設定：${openclaw.apiKeyHint}` : '貼上你的 API key'}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">次選模型</div>
                <div className="mt-1 text-xs text-slate-500">
                  狀態：
                  {openclaw?.providerId2 ? (
                    <span>
                      已設定（{openclaw.providerId2}{openclaw.model2 ? ` / ${openclaw.model2}` : ''}
                      {openclaw.apiKeyHint2 ? ` / ${openclaw.apiKeyHint2}` : ''}）
                    </span>
                  ) : (
                    <span>尚未設定</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-xs text-slate-600">供應商</div>
                    <select
                      value={llm2ProviderId}
                      onChange={(e) => {
                        setLlm2ProviderId(e.target.value)
                        setLlm2Model('')
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:outline-none"
                    >
                      {providerOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">模型名</div>
                    <input
                      value={llm2Model}
                      onChange={(e) => setLlm2Model(e.target.value)}
                      list="llm-model-suggestions-2"
                      placeholder="例如：nvidia/nemotron-3-super-120b-a12b:free"
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                    <datalist id="llm-model-suggestions-2">
                      {(modelSuggestions[llm2ProviderId] || []).map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">API key（儲存後不再顯示）</div>
                    <input
                      value={llm2ApiKey}
                      onChange={(e) => setLlm2ApiKey(e.target.value)}
                      type="password"
                      placeholder={openclaw?.apiKeyHint2 ? `目前已設定：${openclaw.apiKeyHint2}` : '貼上你的 API key（可與首選相同）'}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {llmError ? <div className="mt-3 text-sm text-rose-700">{llmError}</div> : null}

              <div className="mt-4 flex items-center justify-end">
                <button
                  onClick={() => void saveLlm()}
                  disabled={llmSaving || !llmProviderId.trim() || !llmApiKey.trim()}
                  className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold ${
                    !llmSaving && llmProviderId.trim() && llmApiKey.trim()
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  {llmSaving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-base font-semibold">2. 請掃描 WhatsApp QR 碼</div>
              <div className="mt-2 text-base text-slate-600">QR 碼請從 OpenClaw 的 WhatsApp channel 導出。</div>
              {whatsappQrPreview ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <img src={whatsappQrPreview} alt="WhatsApp QR" className="mx-auto max-h-[260px] mix-blend-multiply" />
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-500">尚未顯示 QR 碼</div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-base font-semibold">3. 請填寫你的 Telegram Robot 認證碼</div>
              <div className="mt-2 text-base text-slate-600">BotFather 生成的 token（儲存後不會再顯示）。</div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder={profile?.telegramTokenHint ? `目前已設定：${profile.telegramTokenHint}` : '例如：123456:ABC-DEF...'}
                  type="password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-base text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  disabled={saveState.savingTelegram || telegramToken.trim().length === 0}
                  onClick={() => void saveTelegram()}
                  className={`rounded-lg px-4 py-2 text-base font-semibold ${
                    telegramToken.trim().length > 0
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  {saveState.savingTelegram ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-base font-semibold">4. 請填寫你的 Google 認證碼</div>
              <div className="mt-2 text-base text-slate-600">這一步是 Google OAuth 授權。</div>
              <GoogleOAuthSetupInline />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

}
