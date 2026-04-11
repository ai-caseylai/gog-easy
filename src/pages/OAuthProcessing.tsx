import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMeStore } from '@/stores/useMeStore'
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
    <div className="min-h-screen bg-[#0B1220] text-[#EAF0FF]">
      <div className="mx-auto max-w-[560px] px-4 py-16">
        <div className="rounded-2xl border border-[#24324D] bg-[#111B2E] p-8">
          {isLoading ? (
            <div className="flex items-start gap-4">
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-[#4F8CFF]" />
              <div>
                <div className="text-lg font-semibold">授權處理中…</div>
                <div className="mt-1 text-sm text-[#A9B7D0]">約 3–10 秒，完成後會自動前往控制台。</div>
              </div>
            </div>
          ) : isError ? (
            <div className="flex items-start gap-4">
              <XCircle className="mt-1 h-6 w-6 text-[#FF5A5F]" />
              <div>
                <div className="text-lg font-semibold">授權失敗</div>
                <div className="mt-1 text-sm text-[#A9B7D0]">錯誤代碼：{code || 'unknown'}</div>
                {code === 'missing_google_env' ? (
                  <div className="mt-2 text-sm text-[#A9B7D0]">
                    目前尚未設定 <span className="font-mono">GOOGLE_CLIENT_ID</span> / <span className="font-mono">GOOGLE_CLIENT_SECRET</span>。
                    可先用「OAuth 設定精靈」完成。
                  </div>
                ) : null}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/api/oauth/google/start"
                    className="inline-flex items-center justify-center rounded-xl bg-[#4F8CFF] px-5 py-3 text-sm font-semibold text-[#0B1220] hover:bg-[#3B79F0]"
                  >
                    重試授權
                  </a>
                  <a
                    href="/setup"
                    className="inline-flex items-center justify-center rounded-xl border border-[#24324D] px-5 py-3 text-sm font-semibold hover:bg-white/5"
                  >
                    OAuth 設定精靈
                  </a>
                  <button
                    onClick={() => nav('/', { replace: true })}
                    className="inline-flex items-center justify-center rounded-xl border border-[#24324D] bg-transparent px-5 py-3 text-sm font-semibold text-[#EAF0FF] hover:bg-white/5"
                  >
                    回首頁
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-6 w-6 text-[#2ECC71]" />
              <div>
                <div className="text-lg font-semibold">授權完成</div>
                <div className="mt-1 text-sm text-[#A9B7D0]">正在前往控制台…</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
