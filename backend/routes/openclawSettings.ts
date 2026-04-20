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
      res.json({ success: true, configured: false, providerId: null, model: null, apiKeyHint: null, providerId2: null, model2: null, apiKeyHint2: null, updatedAt: null })
      return
    }

    const meta = row.meta || {}
    const providerId = typeof meta.providerId === 'string' ? meta.providerId : null
    const model = typeof meta.model === 'string' ? meta.model : null
    const providerId2 = typeof meta.providerId2 === 'string' ? meta.providerId2 : null
    const model2 = typeof meta.model2 === 'string' ? meta.model2 : null
    const updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : null

    let hint: string | null = null
    let hint2: string | null = null
    try {
      const plain = decryptAes256Gcm(row.secret_encrypted, mustGetEnv('ENCRYPTION_KEY'))
      const parsed = JSON.parse(plain) as { apiKey?: unknown; apiKey2?: unknown }
      const apiKey = typeof parsed.apiKey === 'string' ? parsed.apiKey : ''
      const apiKey2 = typeof parsed.apiKey2 === 'string' ? parsed.apiKey2 : ''
      hint = apiKey ? apiKeyHint(apiKey) : null
      hint2 = apiKey2 ? apiKeyHint(apiKey2) : null
    } catch {
      hint = null
      hint2 = null
    }

    res.json({ success: true, configured: true, providerId, model, apiKeyHint: hint, providerId2, model2, apiKeyHint2: hint2, updatedAt })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/settings', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const providerId = typeof req.body?.providerId === 'string' ? req.body.providerId.trim() : ''
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : ''
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : ''
    const providerId2 = typeof req.body?.providerId2 === 'string' ? req.body.providerId2.trim() : ''
    const model2 = typeof req.body?.model2 === 'string' ? req.body.model2.trim() : ''
    const apiKey2 = typeof req.body?.apiKey2 === 'string' ? req.body.apiKey2.trim() : ''

    if (!providerId || !apiKey) {
      res.status(400).json({ success: false, error: 'MISSING_PRIMARY_MODEL' })
      return
    }

    const secret = encryptAes256Gcm(JSON.stringify({ apiKey, apiKey2 }), mustGetEnv('ENCRYPTION_KEY'))
    const updatedAt = new Date().toISOString()

    await upsertUserSecret({
      user_id: req.userId,
      kind: 'openclaw_settings',
      meta: { providerId, model: model || null, providerId2: providerId2 || null, model2: model2 || null, updatedAt },
      secret_encrypted: secret,
    })

    res.json({
      success: true,
      configured: true,
      providerId,
      model: model || null,
      apiKeyHint: apiKeyHint(apiKey),
      providerId2: providerId2 || null,
      model2: model2 || null,
      apiKeyHint2: apiKey2 ? apiKeyHint(apiKey2) : null,
      updatedAt,
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router

