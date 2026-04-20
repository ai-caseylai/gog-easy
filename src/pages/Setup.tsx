import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, RefreshCcw, Upload } from 'lucide-react'

type SetupStatus = {
  success: true
  appBaseUrl: string
  redirectUrl: string
  hasGoogleClientId: boolean
  hasGoogleClientSecret: boolean
  hasSupabaseUrl: boolean
  hasSupabaseServiceRoleKey: boolean
}

type PublicSetup = {
  success: true
  appBaseUrl: string
  redirectUrl: string
  supabaseUrl: string | null
}

type LoadState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: SetupStatus }
  | { status: 'error'; message: string }

type OAuthJsonParsed = {
  clientId: string
  clientSecret: string
  redirectUris: string[]
}

type OAuthJsonState =
  | { status: 'idle' }
  | { status: 'ready'; data: OAuthJsonParsed }
  | { status: 'error'; message: string }

type GeneratedSecrets = {
  sessionSecret: string
  encryptionKey: string
  apiKeySalt: string
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="text-sm font-semibold">{props.title}</div>
      <div className="mt-3 text-sm text-slate-600">{props.children}</div>
    </div>
  )
}

function Pill(props: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${props.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
    >
      {props.ok ? props.okText : props.badText}
    </span>
  )
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function getStringArray(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key]
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function parseOAuthClientJson(text: string): OAuthJsonParsed {
  const parsed = JSON.parse(text) as unknown
  if (!isRecord(parsed)) throw new Error('JSON_FORMAT_INVALID')
  const containerUnknown = (parsed.web ?? parsed.installed) as unknown
  const container = isRecord(containerUnknown) ? containerUnknown : parsed
  const clientId = getString(container, 'client_id')
  const clientSecret = getString(container, 'client_secret')
  const redirectUris = getStringArray(container, 'redirect_uris')
  if (!clientId || !clientSecret) throw new Error('JSON_MISSING_CLIENT')
  return { clientId, clientSecret, redirectUris }
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function randomBytesBase64(len: number): string {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  let s = ''
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i])
  return btoa(s)
}

function randomBytesHex(len: number): string {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function generateSecrets(): GeneratedSecrets {
  return {
    encryptionKey: randomBytesBase64(32),
    sessionSecret: base64ToBase64Url(randomBytesBase64(32)),
    apiKeySalt: randomBytesHex(32),
  }
}

export default function Setup() {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [oauthJson, setOauthJson] = useState<OAuthJsonState>({ status: 'idle' })
  const [publicCfg, setPublicCfg] = useState<PublicSetup | null>(null)
  const [secrets, setSecrets] = useState<GeneratedSecrets>(() => generateSecrets())
  const [targetBaseUrl, setTargetBaseUrl] = useState<string>(() => window.location.origin)

  async function load() {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/setup/status', { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP_${res.status}`)
      const json = (await res.json()) as SetupStatus
      if (!json?.success) throw new Error('INVALID_RESPONSE')
      setState({ status: 'ready', data: json })
    } catch (e) {
      setState({ status: 'error', message: String((e as Error).message || 'ERROR') })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!publicCfg?.appBaseUrl) return
    if (publicCfg.appBaseUrl !== 'http://localhost:5173') {
      setTargetBaseUrl(publicCfg.appBaseUrl)
    }
  }, [publicCfg?.appBaseUrl])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/setup/public', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP_${res.status}`)
        const json = (await res.json()) as PublicSetup
        if (!cancelled && json?.success) setPublicCfg(json)
      } catch {
        if (!cancelled) setPublicCfg(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const data = state.status === 'ready' ? state.data : null

  async function onPickJson(file: File | null) {
    if (!file) {
      setOauthJson({ status: 'idle' })
      return
    }
    try {
      const text = await file.text()
      const out = parseOAuthClientJson(text)
      setOauthJson({ status: 'ready', data: out })
    } catch (e) {
      setOauthJson({ status: 'error', message: String((e as Error).message || 'ERROR') })
    }
  }

  const googleLinks = useMemo(() => {
    return {
      apis: 'https://console.cloud.google.com/apis/library',
      consent: 'https://console.cloud.google.com/apis/credentials/consent',
      credentials: 'https://console.cloud.google.com/apis/credentials',
    }
  }, [])

  const vercelSnippet = useMemo(() => {
    const base = (targetBaseUrl || window.location.origin).replace(/\/$/, '')
    const redirect = `${base}/api/oauth/google/callback`
    const supabaseUrl = publicCfg?.supabaseUrl || ''
    const googleId = oauthJson.status === 'ready' ? oauthJson.data.clientId : ''
    const googleSecret = oauthJson.status === 'ready' ? oauthJson.data.clientSecret : ''

    return [
      `SUPABASE_URL=${supabaseUrl}`,
      `SUPABASE_SERVICE_ROLE_KEY=`,
      `APP_BASE_URL=${base}`,
      `GOOGLE_CLIENT_ID=${googleId}`,
      `GOOGLE_CLIENT_SECRET=${googleSecret}`,
      `GOOGLE_REDIRECT_URL=${redirect}`,
      `SESSION_SECRET=${secrets.sessionSecret}`,
      `ENCRYPTION_KEY=${secrets.encryptionKey}`,
      `API_KEY_SALT=${secrets.apiKeySalt}`,
      '',
    ].join('\n')
  }, [oauthJson, publicCfg, secrets, targetBaseUrl])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">Google OAuth 設定精靈</div>
            <div className="mt-1 text-sm text-slate-600">把必做步驟縮到最少，照著按就能跑起授權。</div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCcw className="h-4 w-4" />
            重新檢查
          </button>
        </div>

        {state.status === 'loading' ? (
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : state.status === 'error' ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-rose-700">無法讀取設定狀態</div>
            <div className="mt-2 text-sm text-slate-600">{state.message}</div>
          </div>
        ) : null}

        {data ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card title="1) 確認本機設定（.env）">
              <div className="flex flex-wrap items-center gap-2">
                <Pill ok={data.hasSupabaseUrl} okText="SUPABASE_URL OK" badText="缺 SUPABASE_URL" />
                <Pill ok={data.hasSupabaseServiceRoleKey} okText="SUPABASE_KEY OK" badText="缺 SUPABASE_KEY" />
                <Pill ok={data.hasGoogleClientId} okText="GOOGLE_ID OK" badText="缺 GOOGLE_ID" />
                <Pill ok={data.hasGoogleClientSecret} okText="GOOGLE_SECRET OK" badText="缺 GOOGLE_SECRET" />
              </div>
              <div className="mt-3">
                你的 Redirect URI（必須完全一致）：
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="break-all font-mono text-xs text-slate-900">{data.redirectUrl}</div>
                  <button
                    onClick={() => copyText(data.redirectUrl)}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4" />
                    複製
                  </button>
                </div>
              </div>
            </Card>

            <Card title="1.5) 上傳 OAuth JSON（自動抓 client_id / secret）">
              <div className="flex flex-col gap-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  <Upload className="h-4 w-4" />
                  選擇 JSON 檔
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => void onPickJson(e.target.files?.[0] ?? null)}
                  />
                </label>

                {oauthJson.status === 'ready' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-600">已解析</div>
                    <div className="mt-2 space-y-3">
                      <div>
                        <div className="text-xs text-slate-600">GOOGLE_CLIENT_ID</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <div className="break-all font-mono text-xs text-slate-900">{oauthJson.data.clientId}</div>
                          <button
                            onClick={() => copyText(oauthJson.data.clientId)}
                            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-4 w-4" />
                            複製
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-600">GOOGLE_CLIENT_SECRET</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <div className="break-all font-mono text-xs text-slate-900">{oauthJson.data.clientSecret}</div>
                          <button
                            onClick={() => copyText(oauthJson.data.clientSecret)}
                            className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Copy className="h-4 w-4" />
                            複製
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-slate-600">一鍵產生 .env 片段</div>
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => {
                              const snippet = `GOOGLE_CLIENT_ID=${oauthJson.data.clientId}\nGOOGLE_CLIENT_SECRET=${oauthJson.data.clientSecret}\n`
                              void copyText(snippet)
                            }}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                          >
                            複製 .env 片段
                          </button>
                          <button
                            onClick={() => {
                              const snippet = `GOOGLE_CLIENT_ID=${oauthJson.data.clientId}\nGOOGLE_CLIENT_SECRET=${oauthJson.data.clientSecret}\n`
                              downloadTextFile('google-oauth.env', snippet)
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            下載檔案
                          </button>
                        </div>
                      </div>

                      {oauthJson.data.redirectUris.length ? (
                        <div>
                          <div className="text-xs text-slate-600">JSON 內的 redirect_uris（參考）</div>
                          <div className="mt-2 space-y-1">
                            {oauthJson.data.redirectUris.slice(0, 5).map((u) => (
                              <div key={u} className="break-all font-mono text-xs text-slate-600">
                                {u}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : oauthJson.status === 'error' ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-rose-700">
                    JSON 解析失敗：{oauthJson.message}
                  </div>
                ) : (
                  <div className="text-sm">
                    你可以上傳 Google Cloud 下載的 OAuth client JSON（通常包含 <span className="font-mono">client_id</span> / <span className="font-mono">client_secret</span>）。這些資料只會在瀏覽器本機解析，不會上傳到伺服器。
                  </div>
                )}
              </div>
            </Card>

            <Card title="2) Google Cloud 一鍵導覽（開新分頁）">
              <div className="space-y-2">
                <a className="inline-flex items-center gap-2 text-emerald-700 hover:underline" href={googleLinks.apis} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打開 API Library（啟用 Gmail/Calendar/People）
                </a>
                <a className="inline-flex items-center gap-2 text-emerald-700 hover:underline" href={googleLinks.consent} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打開 OAuth Consent Screen
                </a>
                <a className="inline-flex items-center gap-2 text-emerald-700 hover:underline" href={googleLinks.credentials} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  打開 Credentials（建立 OAuth Client）
                </a>
              </div>
              <div className="mt-3">
                建立 OAuth Client 時，請把剛剛的 Redirect URI 貼進 Authorized redirect URIs。
              </div>
            </Card>

            <Card title="3) 完成授權（給小白的按鈕）">
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/api/oauth/google/start"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  開始用 Google 授權
                </a>
                <a
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  前往控制台
                </a>
              </div>
              <div className="mt-3">
                授權成功後，到控制台確認「連線狀態」是否顯示已授權。
              </div>
            </Card>

            <Card title="3.5) SMS（Twilio）設定">
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="/twilio"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  前往 Twilio 設定
                </a>
                <a
                  href="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  測試手機登入
                </a>
              </div>
              <div className="mt-3">手機 OTP 的 SMS 供應商需先設定好，才能收到驗證碼。</div>
            </Card>

            <Card title="4) 一鍵產生 Vercel 環境變數（可整段貼上）">
              <div>
                這段會自動帶入：部署網域、redirect URL、以及你剛上傳 JSON 的 client_id/secret（若有）。你只要把
                <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> 自己貼上即可。
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-600">部署網址（會用來生成 APP_BASE_URL 與 GOOGLE_REDIRECT_URL）</div>
                <input
                  value={targetBaseUrl}
                  onChange={(e) => setTargetBaseUrl(e.target.value)}
                  placeholder="https://your-project.vercel.app"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setSecrets(generateSecrets())}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  重新生成金鑰
                </button>
                <button
                  onClick={() => void copyText(vercelSnippet)}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  複製整段
                </button>
                <button
                  onClick={() => downloadTextFile('vercel.env', vercelSnippet)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  下載檔案
                </button>
              </div>
              <pre className="mt-3 max-h-[260px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                {vercelSnippet}
              </pre>
              <div className="mt-2 text-xs text-slate-500">
                Vercel 後台 Environment Variables 支援一次貼多行；貼上後請記得保存并触发重新部署。
              </div>
            </Card>

            <Card title="小提醒：為什麼不能 100% 全自動？">
              Google Cloud 的 OAuth 設定需要「帳號本人」登入後台同意（這是 Google 的安全設計），所以我們能做的是：把必填欄位自動算好、提供一鍵開連結、檢查你有沒有漏填。
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  )
}
