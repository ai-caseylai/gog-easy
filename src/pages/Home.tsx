import { useEffect, useState } from 'react'

type HealthState =
  | { status: 'idle' | 'loading' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

export default function Home() {
  const [health, setHealth] = useState<HealthState>({ status: 'idle' })

  useEffect(() => {
    let cancelled = false
    async function run() {
      setHealth({ status: 'loading' })
      try {
        const res = await fetch('/api/health', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP_${res.status}`)
        const json = (await res.json()) as { success?: boolean }
        if (!json?.success) throw new Error('INVALID_RESPONSE')
        if (!cancelled) setHealth({ status: 'ok' })
      } catch (e) {
        if (!cancelled) setHealth({ status: 'error', message: String((e as Error).message || 'ERROR') })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1040px] px-4 py-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-2xl font-semibold md:text-[28px] md:leading-[36px]">一鍵 Google 授權，OpenClaw 立即可用</div>
            <div
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                health.status === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : health.status === 'error'
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-slate-100 text-slate-600'
              }`}
            >
              {health.status === 'ok'
                ? '本機後端：已連線'
                : health.status === 'error'
                  ? `本機後端：未連線（${health.message}）`
                  : '本機後端：檢查中…'}
            </div>
          </div>
          <div className="mt-3 max-w-2xl text-sm text-slate-600 md:text-[14px] md:leading-[22px]">
            三步完成設定：用手機登入 → Google 授權 → 控制台填寫必要資料。
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              用手機登入
            </a>
            <a
              href="/api/oauth/google/start"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              開始用 Google 授權
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              我已授權，前往控制台
            </a>
            <a
              href="/setup"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              OAuth 設定精靈
            </a>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Gmail（可讀寫）</div>
            <div className="mt-2 text-sm text-slate-600">支援列信、讀信、寄信、改標籤、刪除/丟垃圾桶。</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Calendar（可讀寫）</div>
            <div className="mt-2 text-sm text-slate-600">支援查詢、建立、更新與刪除行事曆事件。</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Contacts（可讀寫）</div>
            <div className="mt-2 text-sm text-slate-600">支援搜尋、建立、更新與刪除聯絡人（People API）。</div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">開始試用（最短路徑）</div>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div>
              <div className="text-slate-900">1) 先完成 Google OAuth 設定</div>
              <div className="mt-1">
                在 Google Cloud OAuth Client 加入 Redirect URI：<span className="font-mono">http://localhost:3001/api/oauth/google/callback</span>，並把
                <span className="font-mono">GOOGLE_CLIENT_ID</span>、<span className="font-mono">GOOGLE_CLIENT_SECRET</span> 填進專案根目錄的
                <span className="font-mono">.env</span>。
              </div>
            </div>
            <div>
              <div className="text-slate-900">2) 點「開始用 Google 授權」</div>
              <div className="mt-1">同意授權後會自動進入控制台。</div>
            </div>
            <div>
              <div className="text-slate-900">3) 到控制台完成簡易設定</div>
              <div className="mt-1">依序設定智能體、LLM、WhatsApp QR、Telegram token、Google 授權狀態。</div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">常見問題</div>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div>
              <div className="text-slate-900">授權失敗怎麼辦？</div>
              <div className="mt-1">
                先確認 Google OAuth 的 Redirect URI 是否完全一致（<span className="font-mono">http://localhost:3001/api/oauth/google/callback</span>），再回到本頁按「開始用 Google 授權」重試；若仍失敗可改用無痕視窗。
              </div>
            </div>
            <div>
              <div className="text-slate-900">要換 Google 帳號？</div>
              <div className="mt-1">到控制台按「解除連線」，再重新授權即可。</div>
            </div>
            <div>
              <div className="text-slate-900">OpenClaw 顯示無法存取？</div>
              <div className="mt-1">先確認 Google 是否已授權，並在控制台檢查連線狀態。</div>
            </div>
            <div>
              <div className="text-slate-900">我之前已授權過（只讀），現在要用 CRUD？</div>
              <div className="mt-1">到控制台按「重新授權」讓 Google 重新同意可讀寫權限。</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
