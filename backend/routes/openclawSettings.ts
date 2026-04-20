import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { decryptAes256Gcm, encryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { getUserSecret, upsertUserSecret } from '../lib/repo.js'

const router = Router()

function apiKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}****`
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
}

router.get('/settings', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const row = await getUserSecret(req.userId, 'openclaw_settings')
    if (!row) {
      res.json({ success: true, configured: false, providerId: null, model: null, apiKeyHint: null, updatedAt: null })
      return
    }

    const meta = row.meta || {}
    const providerId = typeof meta.providerId === 'string' ? meta.providerId : null
    const model = typeof meta.model === 'string' ? meta.model : null
    const updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : null

    let hint: string | null = null
    try {
      const plain = decryptAes256Gcm(row.secret_encrypted, mustGetEnv('ENCRYPTION_KEY'))
      const parsed = JSON.parse(plain) as { apiKey?: unknown }
      const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : ''
      hint = apiKey ? apiKeyHint(apiKey) : null
    } catch {
      hint = null
    }

    res.json({ success: true, configured: true, providerId, model, apiKeyHint: hint, updatedAt })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/settings', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId.trim() : ''
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : ''
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : ''

    if (!providerId) {
      res.status(400).json({ success: false, error: 'MISSING_PROVIDER_ID' })
      return
    }
    if (!apiKey) {
      res.status(400).json({ success: false, error: 'MISSING_API_KEY' })
      return
    }

    const secret = encryptAes256Gcm(JSON.stringify({ apiKey }), mustGetEnv('ENCRYPTION_KEY'))
    const updatedAt = new Date().toISOString()

    await upsertUserSecret({
      user_id: req.userId,
      kind: 'openclaw_settings',
      meta: { providerId, model: model || null, updatedAt },
      secret_encrypted: secret,
    })

    res.json({ success: true, configured: true, providerId, model: model || null, apiKeyHint: apiKeyHint(apiKey), updatedAt })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router

