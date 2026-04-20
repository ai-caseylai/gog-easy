import { Router, type Request, type Response } from 'express'
import { getAdminUsers } from '../lib/adminUsers.js'
import { clearAdminSessionCookie, setAdminSessionCookie, signAdminSession } from '../lib/adminSession.js'
import { requireAdmin, type AdminAuthedRequest } from '../middleware/adminAuth.js'
import { getAdminUserByEmail } from '../lib/repo.js'
import { verifyPassword } from '../lib/password.js'

const router = Router()

router.post('/login', (req: Request, res: Response) => {
  void (async () => {
    const email = String((req.body as { email?: unknown })?.email || '').trim().toLowerCase()
    const password = String((req.body as { password?: unknown })?.password || '')

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
      return
    }

    try {
      const dbUser = await getAdminUserByEmail(email)
      if (dbUser && verifyPassword(password, dbUser.password_hash)) {
        const token = signAdminSession({ email: dbUser.email, role: dbUser.role })
        setAdminSessionCookie(res, token)
        res.json({ success: true, user: { email: dbUser.email, role: dbUser.role } })
        return
      }
    } catch {
      void 0
    }

    const found = getAdminUsers().find((u) => u.email === email && u.password === password)
    if (!found) {
      res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' })
      return
    }
    const token = signAdminSession({ email: found.email, role: found.role })
    setAdminSessionCookie(res, token)
    res.json({ success: true, user: { email: found.email, role: found.role } })
  })()
})

router.post('/logout', (req: Request, res: Response) => {
  void req
  clearAdminSessionCookie(res)
  res.json({ success: true })
})

router.get('/me', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as AdminAuthedRequest).admin
  res.json({ success: true, user: { email: admin.email, role: admin.role } })
})

export default router
