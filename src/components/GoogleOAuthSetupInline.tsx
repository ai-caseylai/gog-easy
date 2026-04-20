import { useState } from 'react'
import { Copy, Upload } from 'lucide-react'

type OAuthJsonParsed = {
  clientId: string
  clientSecret: string
  redirectUris: string[]
}

type OAuthJsonState =
  | { status: 'idle' }
  | { status: 'ready'; data: OAuthJsonParsed }
  | { status: 'error'; message: string }

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

export default function GoogleOAuthSetupInline() {
  const [oauthJson, setOauthJson] = useState<OAuthJsonState>({ status: 'idle' })

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

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <Upload className="h-4 w-4" />
          上傳 Google OAuth JSON 檔案
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
                    下載 .env 檔案
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : oauthJson.status === 'error' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-rose-700">JSON 解析失敗：{oauthJson.message}</div>
        ) : null}
      </div>
    </div>
  )
}
