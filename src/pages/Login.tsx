import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPost } from '../utils/api'
import { useMeStore } from '../stores/useMeStore'

type Step = 'phone' | 'code'

export default function Login() {
  const nav = useNavigate()
  const refresh = useMeStore((s) => s.refresh)
  const user = useMeStore((s) => s.user)

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function formatError(message: string): string {
    if (message === 'TWILIO_NOT_CONFIGURED') return '尚未設定 SMS（Twilio）。請先到 /twilio 完成設定。'
    if (message === 'TWILIO_AUTH_TOKEN_DECRYPT_FAILED') return 'SMS（Twilio）設定的 Auth Token 無法解密，請到 /twilio 重新填一次 Auth Token。'
    if (message === 'UNAUTHORIZED') return '沒有權限存取設定。若你在部署環境，請先設定 SETUP_TOKEN。'
    return message
  }

  useEffect(() => {
    if (user) nav('/dashboard', { replace: true })
  }, [nav, user])

  const canStart = useMemo(() => phone.trim().startsWith('+') && phone.trim().length >= 8, [phone])
  const canVerify = useMemo(() => token.trim().length >= 4, [token])

  async function start() {
    setLoading(true)
    setError(null)
    try {
      await apiPost('/api/auth/phone/start', { phone: phone.trim() })
      setStep('code')
    } catch (e) {
      setError(formatError(String((e as Error).message || 'ERROR')))
    } finally {
      setLoading(false)
    }
  }

  async function verify() {
    setLoading(true)
    setError(null)
    try {
      await apiPost('/api/auth/phone/verify', { phone: phone.trim(), token: token.trim() })
      await refresh()
      nav('/dashboard', { replace: true })
    } catch (e) {
      setError(formatError(String((e as Error).message || 'ERROR')))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[560px] px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-lg font-semibold">手機號碼登入</div>
          <div className="mt-1 text-sm text-slate-600">輸入 +國碼 的手機號碼，我們會發送一次性驗證碼。</div>

          <div className="mt-6 space-y-4">
            <div>
              <div className="text-xs text-slate-600">手機號碼（E.164）</div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="例如：+85291234567"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                disabled={loading || step === 'code'}
              />
            </div>

            {step === 'code' ? (
              <div>
                <div className="text-xs text-slate-600">驗證碼</div>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="輸入簡訊驗證碼"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  disabled={loading}
                />
              </div>
            ) : null}

            {error ? <div className="text-sm text-rose-700">{error}</div> : null}

            {step === 'phone' ? (
              <button
                onClick={start}
                disabled={!canStart || loading}
                className={`w-full rounded-xl px-5 py-3 text-sm font-semibold ${
                  canStart && !loading ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                }`}
              >
                {loading ? '發送中…' : '發送驗證碼'}
              </button>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={verify}
                  disabled={!canVerify || loading}
                  className={`flex-1 rounded-xl px-5 py-3 text-sm font-semibold ${
                    canVerify && !loading ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  }`}
                >
                  {loading ? '驗證中…' : '登入'}
                </button>
                <button
                  onClick={() => {
                    setStep('phone')
                    setToken('')
                    setError(null)
                  }}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  改手機號碼
                </button>
              </div>
            )}

            <a href="/" className="block text-center text-sm text-slate-600 hover:underline">
              回首頁
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
