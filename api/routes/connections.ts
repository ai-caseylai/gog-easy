import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { decryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { deleteGoogleConnectionByUserId, getGoogleConnectionByUserId, revokeApiKeysByUserId } from '../lib/repo.js'

const router = Router()

router.post('/google/revoke', requireSession, async (req: AuthedRequest, res: Response) => {
  const conn = await getGoogleConnectionByUserId(req.userId)
  if (conn) {
    try {
      const refresh = decryptAes256Gcm(conn.refresh_token_encrypted, mustGetEnv('ENCRYPTION_KEY'))
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      void 0
    }
  }
  await deleteGoogleConnectionByUserId(req.userId)
  await revokeApiKeysByUserId(req.userId)
  res.json({ success: true })
})

export default router
