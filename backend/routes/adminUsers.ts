import { Router, type Request, type Response } from 'express'
import { requireAdmin, type AdminAuthedRequest } from '../middleware/adminAuth.js'
import { createAdminUser, deleteAdminUser, listAdminUsers, updateAdminUser } from '../lib/repo.js'
import { hashPassword } from '../lib/password.js'

const router = Router()

function requireSuperAdmin(req: Request, res: Response): { ok: true; email: string } | { ok: false } {
  const admin = (req as AdminAuthedRequest).admin
  if (!admin || admin.role !== 'super_admin') {
    res.status(403).json({ success: false, error: 'FORBIDDEN' })
    return { ok: false }
  }
  return { ok: true, email: admin.email }
}

router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  void req
  const gate = requireSuperAdmin(req, res)
  if (!gate.ok) return
  const users = await listAdminUsers()
  res.json({ success: true, users })
})

router.post('/users', requireAdmin, async (req: Request, res: Response) => {
  const gate = requireSuperAdmin(req, res)
  if (!gate.ok) return

  const body = req.body as { email?: unknown; role?: unknown; password?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role === 'super_admin' ? 'super_admin' : 'admin'
  const password = typeof body.password === 'string' ? body.password : ''

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
    return
  }

  const password_hash = hashPassword(password)
  const created = await createAdminUser({ email, role, password_hash })
  res.json({ success: true, user: { id: created.id, email: created.email, role: created.role, created_at: created.created_at, updated_at: created.updated_at } })
})

router.post('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  const gate = requireSuperAdmin(req, res)
  if (!gate.ok) return

  const id = String(req.params.id || '').trim()
  const body = req.body as { role?: unknown; password?: unknown }
  const role = body.role === 'super_admin' ? 'super_admin' : body.role === 'admin' ? 'admin' : undefined
  const password = typeof body.password === 'string' ? body.password : ''

  if (!id) {
    res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
    return
  }

  const out = await updateAdminUser({
    id,
    role,
    password_hash: password ? hashPassword(password) : undefined,
  })

  res.json({ success: true, user: { id: out.id, email: out.email, role: out.role, created_at: out.created_at, updated_at: out.updated_at } })
})

router.post('/users/:id/delete', requireAdmin, async (req: Request, res: Response) => {
  const gate = requireSuperAdmin(req, res)
  if (!gate.ok) return
  const id = String(req.params.id || '').trim()
  if (!id) {
    res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
    return
  }
  await deleteAdminUser(id)
  res.json({ success: true })
})

export default router

