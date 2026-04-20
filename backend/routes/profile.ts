import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { decryptAes256Gcm, encryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { getUserSecret, upsertUserSecret } from '../lib/repo.js'

const router = Router()

function tokenHint(token: string): string {
  const trimmed = token.trim()
  if (!trimmed) return ''
  if (trimmed.length <= 6) return `${trimmed.slice(0, 2)}****`
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`
}

type ProfileSecret = {
  whatsappQrDataUrl?: string | null
  telegramToken?: string | null
}

router.get('/', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const row = await getUserSecret(req.userId, 'profile')
    if (!row) {
      res.json({
        success: true,
        data: {
          agentType: null,
          whatsappQrDataUrl: null,
          telegramTokenHint: null,
          updatedAt: null,
        },
      })
      return
    }

    const meta = row.meta || {}
    const agentType = typeof meta.agentType === 'string' ? meta.agentType : null
    const updatedAt = typeof meta.updatedAt === 'string' ? meta.updatedAt : null

    let secret: ProfileSecret = {}
    try {
      const plain = decryptAes256Gcm(row.secret_encrypted, mustGetEnv('ENCRYPTION_KEY'))
      secret = JSON.parse(plain) as ProfileSecret
    } catch {
      secret = {}
    }

    const telegramToken = typeof secret.telegramToken === 'string' ? secret.telegramToken : ''
    res.json({
      success: true,
      data: {
        agentType,
        whatsappQrDataUrl: typeof secret.whatsappQrDataUrl === 'string' ? secret.whatsappQrDataUrl : null,
        telegramTokenHint: telegramToken ? tokenHint(telegramToken) : null,
        updatedAt,
      },
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const agentTypeRaw = req.body?.agentType
    const whatsappQrDataUrlRaw = req.body?.whatsappQrDataUrl
    const telegramTokenRaw = req.body?.telegramToken

    const nextAgentType = typeof agentTypeRaw === 'string' ? agentTypeRaw.trim() : undefined
    if (nextAgentType !== undefined && nextAgentType !== 'openclaw' && nextAgentType !== 'hermes' && nextAgentType !== '') {
      res.status(400).json({ success: false, error: 'INVALID_AGENT_TYPE' })
      return
    }

    const row = await getUserSecret(req.userId, 'profile')
    let prev: ProfileSecret = {}
    let prevMeta: Record<string, unknown> = {}
    if (row) {
      prevMeta = row.meta || {}
      try {
        const plain = decryptAes256Gcm(row.secret_encrypted, mustGetEnv('ENCRYPTION_KEY'))
        prev = JSON.parse(plain) as ProfileSecret
      } catch {
        prev = {}
      }
    }

    const merged: ProfileSecret = {
      whatsappQrDataUrl: prev.whatsappQrDataUrl ?? null,
      telegramToken: prev.telegramToken ?? null,
    }

    if (whatsappQrDataUrlRaw !== undefined) {
      merged.whatsappQrDataUrl = typeof whatsappQrDataUrlRaw === 'string' ? whatsappQrDataUrlRaw : null
    }
    if (telegramTokenRaw !== undefined) {
      merged.telegramToken = typeof telegramTokenRaw === 'string' ? telegramTokenRaw : null
    }

    const updatedAt = new Date().toISOString()
    const meta: Record<string, unknown> = {
      ...prevMeta,
      updatedAt,
    }
    if (nextAgentType !== undefined) {
      meta.agentType = nextAgentType || null
    }

    const secret = encryptAes256Gcm(JSON.stringify(merged), mustGetEnv('ENCRYPTION_KEY'))
    await upsertUserSecret({ user_id: req.userId, kind: 'profile', meta, secret_encrypted: secret })

    const telegramToken = typeof merged.telegramToken === 'string' ? merged.telegramToken : ''
    const agentType = meta.agentType === 'openclaw' || meta.agentType === 'hermes' ? meta.agentType : null
    res.json({
      success: true,
      data: {
        agentType,
        whatsappQrDataUrl: typeof merged.whatsappQrDataUrl === 'string' ? merged.whatsappQrDataUrl : null,
        telegramTokenHint: telegramToken ? tokenHint(telegramToken) : null,
        updatedAt,
      },
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router
