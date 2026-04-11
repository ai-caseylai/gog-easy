import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { mustGetEnv } from '../lib/env.js'
import { randomBase64Url, sha256Hex } from '../lib/crypto.js'
import { insertApiKey, revokeApiKeysByUserId } from '../lib/repo.js'

const router = Router()

router.post('/rotate', requireSession, async (req: AuthedRequest, res: Response) => {
  const salt = mustGetEnv('API_KEY_SALT')
  const raw = `oc_live_${randomBase64Url(32)}`
  const hash = sha256Hex(`${salt}:${raw}`)
  const prefix = raw.slice(0, 12)

  await revokeApiKeysByUserId(req.userId)
  await insertApiKey({ user_id: req.userId, key_prefix: prefix, key_hash: hash })

  res.json({ success: true, apiKey: { key: raw, prefix } })
})

export default router

