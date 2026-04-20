import { Router, type Request, type Response } from 'express'
import { setCookie, clearCookie } from '../lib/cookies.js'
import { sessionCookieName, signSession } from '../lib/session.js'
import { decryptAes256Gcm, sha256Hex } from '../lib/crypto.js'
import { getEnv, mustGetEnv } from '../lib/env.js'
import { getAppSecret, getLatestPhoneOtp, incrementOtpAttempts, insertPhoneOtp, upsertPhoneUser } from '../lib/repo.js'

const router = Router()

function normalizePhone(input: unknown): string {
  const phone = typeof input === 'string' ? input.trim() : ''
  if (!phone) throw new Error('INVALID_PHONE')
  if (!phone.startsWith('+')) throw new Error('PHONE_MUST_BE_E164')
  return phone
}

function generateCode(): string {
  const n = Math.floor(100000 + Math.random() * 900000)
  return String(n)
}

async function sendTwilioSms(params: {
  accountSid: string
  authToken: string
  from?: string
  messagingServiceSid?: string
  to: string
  body: string
}): Promise<void> {
  const form = new URLSearchParams()
  form.set('To', params.to)
  form.set('Body', params.body)
  if (params.messagingServiceSid) form.set('MessagingServiceSid', params.messagingServiceSid)
  else if (params.from) form.set('From', params.from)
  else throw new Error('MISSING_FROM_OR_MESSAGING_SERVICE')

  const auth = Buffer.from(`${params.accountSid}:${params.authToken}`, 'utf8').toString('base64')
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(params.accountSid)}/Messages.json`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || 'TWILIO_REQUEST_FAILED')
  }
}

router.post('/start', async (req: Request, res: Response) => {
  try {
    const phone = normalizePhone(req.body?.phone)
    const cfg = await getAppSecret('twilio')
    if (!cfg) {
      res.status(400).json({ success: false, error: 'TWILIO_NOT_CONFIGURED' })
      return
    }
    const meta = cfg.meta || {}
    const accountSid = typeof meta.accountSid === 'string' ? meta.accountSid : ''
    const from = typeof meta.from === 'string' ? meta.from : undefined
    const messagingServiceSid = typeof meta.messagingServiceSid === 'string' ? meta.messagingServiceSid : undefined
    if (!accountSid) {
      res.status(400).json({ success: false, error: 'TWILIO_NOT_CONFIGURED' })
      return
    }

    const encryptionKey = mustGetEnv('ENCRYPTION_KEY')
    let authToken = ''
    try {
      authToken = decryptAes256Gcm(cfg.secret_encrypted, encryptionKey)
    } catch {
      res.status(400).json({ success: false, error: 'TWILIO_AUTH_TOKEN_DECRYPT_FAILED' })
      return
    }

    const code = generateCode()
    const salt = mustGetEnv('API_KEY_SALT')
    const codeHash = sha256Hex(`${salt}:${phone}:${code}`)
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await insertPhoneOtp({ phone, code_hash: codeHash, expires_at: expires })

    const appName = getEnv('OTP_APP_NAME') || 'OpenClaw'
    await sendTwilioSms({
      accountSid,
      authToken,
      from,
      messagingServiceSid,
      to: phone,
      body: `[${appName}] 你的驗證碼是 ${code}（10 分鐘內有效）`,
    })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const phone = normalizePhone(req.body?.phone)
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : ''
    if (!token) {
      res.status(400).json({ success: false, error: 'INVALID_TOKEN' })
      return
    }

    const otp = await getLatestPhoneOtp(phone)
    if (!otp) {
      res.status(400).json({ success: false, error: 'OTP_NOT_FOUND' })
      return
    }
    const expired = Date.parse(otp.expires_at) < Date.now()
    if (expired) {
      res.status(400).json({ success: false, error: 'OTP_EXPIRED' })
      return
    }
    if (otp.attempts >= 5) {
      res.status(400).json({ success: false, error: 'OTP_TOO_MANY_ATTEMPTS' })
      return
    }

    const salt = mustGetEnv('API_KEY_SALT')
    const expected = sha256Hex(`${salt}:${phone}:${token}`)
    if (expected !== otp.code_hash) {
      await incrementOtpAttempts(otp.id)
      res.status(400).json({ success: false, error: 'INVALID_OTP' })
      return
    }

    const user = await upsertPhoneUser({ phone })
    const session = signSession(user.id)
    setCookie(res, sessionCookieName(), session, { httpOnly: true, sameSite: 'lax', maxAgeSeconds: 60 * 60 * 24 * 30 })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/logout', (req: Request, res: Response) => {
  void req
  clearCookie(res, sessionCookieName())
  res.json({ success: true })
})

export default router
