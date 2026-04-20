import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, RefreshCcw, Upload } from 'lucide-react'
import { apiGet } from '../utils/api'

type SetupStatus = {
  success: true
  appBaseUrl: string
  redirectUrl: string
  hasGoogleClientId: boolean
  hasGoogleClientSecret: boolean
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

export default function GoogleAuthGuideModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [oauthJson, setOauthJson] = useState<OAuthJsonState>({ status: 'idle' })

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, open])

  async function load() {
    setState({ status: 'loading' })
    try {
      const json = await apiGet<SetupStatus>('/api/setup/status')
      setState({ status: 'ready', data: json })
    } catch (e) {
      setState({ status: 'error', message: String((e as Error).message || 'ERROR') })
    }
  }

  useEffect(() => {
    if (!open) return
    void load()
  }, [open])


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

  const data = state.status === 'ready' ? state.data : null

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="w-full max-w-[980px] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold">Google 授權指引</div>
            <div className="mt-1 text-sm text-slate-600">接下來會跳轉到 Google 做 OAuth 授權。</div>
            <div className="mt-2 text-sm text-slate-500">
              提示：按下「繼續授權」前，先登入 Gmail；再到 <span className="font-mono">console.cloud.google.com</span> → APIs（Library）→ Credentials。
              建好 OAuth Client 後，把 <span className="font-mono">GOOGLE_CLIENT_ID</span> / <span className="font-mono">GOOGLE_CLIENT_SECRET</span> 填到環境變數。
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            關閉
          </button>
        </div>

        <div className="mt-5 max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Google OAuth 設定精靈（內容同 /setup）</div>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              重新檢查
            </button>
          </div>

          {state.status === 'loading' ? <div className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" /> : null}
          {state.status === 'error' ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold text-rose-700">無法讀取設定狀態</div>
              <div className="mt-2 text-sm text-slate-600">{state.message}</div>
            </div>
          ) : null}

          {data ? (
            <div className="grid grid-cols-1 gap-6">
              <Card title="1) 確認本機設定（.env）">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill ok={data.hasGoogleClientId} okText="GOOGLE_ID OK" badText="缺 GOOGLE_ID" />
                  <Pill ok={data.hasGoogleClientSecret} okText="GOOGLE_SECRET OK" badText="缺 GOOGLE_SECRET" />
                </div>
                <div className="mt-3">
                  你的 Redirect URI（必須完全一致）：
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="break-all font-mono text-xs text-slate-900">{data.redirectUrl}</div>
                    <button
                      onClick={() => void copyText(data.redirectUrl)}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      複製
                    </button>
                  </div>
                </div>
              </Card>

              <Card title="2) Google Cloud 一鍵導覽（開新分頁）">
                <div className="space-y-2">
                  <a className="inline-flex items-center gap-2 text-emerald-700 hover:underline" href={googleLinks.apis} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    打開 API Library（啟用 Gmail/Calendar/People）
                  </a>
                  <a
                    className="inline-flex items-center gap-2 text-emerald-700 hover:underline"
                    href={googleLinks.consent}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打開 OAuth Consent Screen
                  </a>
                  <a
                    className="inline-flex items-center gap-2 text-emerald-700 hover:underline"
                    href={googleLinks.credentials}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                    打開 Credentials（建立 OAuth Client）
                  </a>
                </div>
                <div className="mt-3">建立 OAuth Client 時，請把剛剛的 Redirect URI 貼進 Authorized redirect URIs。</div>
              </Card>

              <Card title="3) 上傳 OAuth JSON（自動抓 client_id / secret）">
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
                              onClick={() => void copyText(oauthJson.data.clientId)}
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
                              onClick={() => void copyText(oauthJson.data.clientSecret)}
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-rose-700">JSON 解析失敗：{oauthJson.message}</div>
                  ) : (
                    <div className="text-sm">
                      你可以上傳 Google Cloud 下載的 OAuth client JSON（通常包含 <span className="font-mono">client_id</span> /{' '}
                      <span className="font-mono">client_secret</span>）。這些資料只會在瀏覽器本機解析，不會上傳到伺服器。
                    </div>
                  )}
                </div>
              </Card>

              <Card title="4) 完成授權（給小白的按鈕）">
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
                <div className="mt-3">授權成功後，到控制台確認「連線狀態」是否顯示已授權。</div>
              </Card>

            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            取消
          </button>
          <a
            href="/api/oauth/google/start"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            繼續授權
          </a>
        </div>
      </div>
    </div>
  )
}
