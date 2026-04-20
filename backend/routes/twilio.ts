import { Router, type Request, type Response } from 'express'
import { requireSession, type AuthedRequest } from '../middleware/sessionAuth.js'
import { decryptAes256Gcm, encryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { getUserSecret, upsertUserSecret } from '../lib/repo.js'

const router = Router()

function kind() {
  return 'twilio'
}

function normalizeSid(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw new Error('INVALID_ACCOUNT_SID')
  return s
}

function normalizeToken(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) throw new Error('INVALID_AUTH_TOKEN')
  return s
}

function normalizeFrom(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

function normalizeMsgServiceSid(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

router.get('/', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const existing = await getUserSecret(userId, kind())
    if (!existing) {
      res.json({ success: true, configured: false })
      return
    }
    const meta = existing.meta || {}
    res.json({
      success: true,
      configured: true,
      accountSid: typeof meta.accountSid === 'string' ? meta.accountSid : null,
      from: typeof meta.from === 'string' ? meta.from : null,
      messagingServiceSid: typeof meta.messagingServiceSid === 'string' ? meta.messagingServiceSid : null,
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const accountSid = normalizeSid(req.body?.accountSid)
    const authToken = normalizeToken(req.body?.authToken)
    const from = normalizeFrom(req.body?.from)
    const messagingServiceSid = normalizeMsgServiceSid(req.body?.messagingServiceSid)

    if (!from && !messagingServiceSid) {
      res.status(400).json({ success: false, error: 'MISSING_FROM_OR_MESSAGING_SERVICE' })
      return
    }

    const encryptionKey = mustGetEnv('ENCRYPTION_KEY')
    const secretEncrypted = encryptAes256Gcm(authToken, encryptionKey)
    await upsertUserSecret({
      user_id: userId,
      kind: kind(),
      meta: {
        accountSid,
        from,
        messagingServiceSid,
      },
      secret_encrypted: secretEncrypted,
    })

    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/test-sms', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : ''
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : 'Test SMS'
    if (!to || !to.startsWith('+')) {
      res.status(400).json({ success: false, error: 'INVALID_TO' })
      return
    }

    const existing = await getUserSecret(userId, kind())
    if (!existing) {
      res.status(400).json({ success: false, error: 'TWILIO_NOT_CONFIGURED' })
      return
    }

    const meta = existing.meta || {}
    const accountSid = typeof meta.accountSid === 'string' ? meta.accountSid : ''
    const from = typeof meta.from === 'string' ? meta.from : ''
    const messagingServiceSid = typeof meta.messagingServiceSid === 'string' ? meta.messagingServiceSid : ''
    if (!accountSid) {
      res.status(400).json({ success: false, error: 'INVALID_ACCOUNT_SID' })
      return
    }
    if (!from && !messagingServiceSid) {
      res.status(400).json({ success: false, error: 'MISSING_FROM_OR_MESSAGING_SERVICE' })
      return
    }

    const encryptionKey = mustGetEnv('ENCRYPTION_KEY')
    const authToken = decryptAes256Gcm(existing.secret_encrypted, encryptionKey)

    const form = new URLSearchParams()
    form.set('To', to)
    form.set('Body', body)
    if (messagingServiceSid) form.set('MessagingServiceSid', messagingServiceSid)
    else form.set('From', from)

    const auth = Buffer.from(`${accountSid}:${authToken}`, 'utf8').toString('base64')
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`

    const twilioRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const text = await twilioRes.text()
    if (!twilioRes.ok) {
      res.status(400).json({ success: false, error: 'TWILIO_REQUEST_FAILED', details: text })
      return
    }

    res.json({ success: true, result: text })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router

