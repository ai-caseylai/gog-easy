import { Router, type Request, type Response } from 'express'
import { decryptAes256Gcm, encryptAes256Gcm } from '../lib/crypto.js'
import { getEnv, isProd, mustGetEnv } from '../lib/env.js'
import { getAppSecret, upsertAppSecret } from '../lib/repo.js'

const router = Router()

function configuredSetupToken(): string | null {
  return getEnv('SETUP_TOKEN') || null
}

function checkToken(req: Request): boolean {
  const configured = configuredSetupToken()
  if (!configured) return !isProd()
  const header = typeof req.headers['x-setup-token'] === 'string' ? req.headers['x-setup-token'] : null
  const bodyToken = typeof req.body?.setupToken === 'string' ? req.body.setupToken : null
  const provided = (header || bodyToken || '').trim()
  return Boolean(provided) && provided === configured
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

router.get('/status', async (req: Request, res: Response) => {
  try {
    if (!checkToken(req)) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' })
      return
    }
    const cfg = await getAppSecret('twilio')
    if (!cfg) {
      res.json({ success: true, configured: false })
      return
    }
    const meta = cfg.meta || {}
    res.json({
      success: true,
      configured: true,
      accountSid: typeof meta.accountSid === 'string' ? meta.accountSid : null,
      from: typeof meta.from === 'string' ? meta.from : null,
      messagingServiceSid: typeof meta.messagingServiceSid === 'string' ? meta.messagingServiceSid : null,
      requiresSetupToken: isProd() || Boolean(configuredSetupToken()),
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/save', async (req: Request, res: Response) => {
  try {
    if (!checkToken(req)) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' })
      return
    }
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
    await upsertAppSecret({
      kind: 'twilio',
      meta: { accountSid, from, messagingServiceSid },
      secret_encrypted: secretEncrypted,
    })

    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/test-sms', async (req: Request, res: Response) => {
  try {
    if (!checkToken(req)) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' })
      return
    }
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : ''
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : 'Test SMS'
    if (!to || !to.startsWith('+')) {
      res.status(400).json({ success: false, error: 'INVALID_TO' })
      return
    }

    const cfg = await getAppSecret('twilio')
    if (!cfg) {
      res.status(400).json({ success: false, error: 'TWILIO_NOT_CONFIGURED' })
      return
    }
    const meta = cfg.meta || {}
    const accountSid = typeof meta.accountSid === 'string' ? meta.accountSid : ''
    const from = typeof meta.from === 'string' ? meta.from : ''
    const messagingServiceSid = typeof meta.messagingServiceSid === 'string' ? meta.messagingServiceSid : ''
    if (!accountSid) {
      res.status(400).json({ success: false, error: 'TWILIO_NOT_CONFIGURED' })
      return
    }
    if (!from && !messagingServiceSid) {
      res.status(400).json({ success: false, error: 'MISSING_FROM_OR_MESSAGING_SERVICE' })
      return
    }

    const encryptionKey = mustGetEnv('ENCRYPTION_KEY')
    const authToken = decryptAes256Gcm(cfg.secret_encrypted, encryptionKey)

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
