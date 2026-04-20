import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { getActiveApiKeyPrefix, getGoogleConnectionByUserId, getUserById } from '../lib/repo.js'

const router = Router()

router.get('/', requireSession, async (req: AuthedRequest, res: Response) => {
  const user = await getUserById(req.userId)
  if (!user) {
    res.status(401).json({ success: false, error: 'UNAUTHENTICATED' })
    return
  }
  const conn = await getGoogleConnectionByUserId(user.id)
  const apiKeyPrefix = await getActiveApiKeyPrefix(user.id)
  res.json({
    success: true,
    user: { id: user.id, email: user.email, phone: user.phone, authProvider: user.auth_provider, displayName: user.display_name },
    google: conn
      ? { status: conn.status, scopes: conn.scopes }
      : { status: 'disconnected', scopes: { gmailReadonly: false, calendarReadonly: false, contactsReadonly: false } },
    apiKey: apiKeyPrefix ? { prefix: apiKeyPrefix } : null,
  })
})

export default router
