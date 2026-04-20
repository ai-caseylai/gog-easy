import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMeStore } from '../stores/useMeStore'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function OAuthProcessing() {
  const q = useQuery()
  const status = q.get('status')
  const code = q.get('code')
  const nav = useNavigate()
  const refresh = useMeStore((s) => s.refresh)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (status === 'success') {
        await refresh()
        if (!cancelled) nav('/dashboard', { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nav, refresh, status])

  const isLoading = !status || status === 'success'
  const isError = status === 'error'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[560px] px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {isLoading ? (
            <div className="flex items-start gap-4">
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-emerald-600" />
              <div>
                <div className="text-lg font-semibold">授權處理中…</div>
                <div className="mt-1 text-sm text-slate-600">約 3–10 秒，完成後會自動前往控制台。</div>
              </div>
            </div>
          ) : isError ? (
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 h-6 w-6 text-rose-700" />
              <div>
                <div className="text-lg font-semibold">授權失敗</div>
                <div className="mt-1 text-sm text-slate-600">錯誤代碼：{code || 'unknown'}</div>
                {code === 'missing_google_env' ? (
                  <div className="mt-2 text-sm text-slate-600">
                    目前尚未設定 <span className="font-mono">GOOGLE_CLIENT_ID</span> / <span className="font-mono">GOOGLE_CLIENT_SECRET</span>。
                    可先用「OAuth 設定精靈」完成。
                  </div>
                ) : null}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/api/oauth/google/start"
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    重試授權
                  </a>
                  <a
                    href="/setup"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    OAuth 設定精靈
                  </a>
                  <button
                    onClick={() => nav('/', { replace: true })}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    回首頁
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-6 w-6 text-emerald-600" />
              <div>
                <div className="text-lg font-semibold">授權完成</div>
                <div className="mt-1 text-sm text-slate-600">正在前往控制台…</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
