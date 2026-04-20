import type { NextFunction, Request, Response } from 'express'
import { parseCookies } from '../lib/cookies.js'
import { adminCookieName, verifyAdminSession, type AdminSessionPayload } from '../lib/adminSession.js'

export type AdminAuthedRequest = Request & { admin: AdminSessionPayload }

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req)
  const token = cookies[adminCookieName()]
  if (!token) {
    res.status(401).json({ success: false, error: 'ADMIN_UNAUTHENTICATED' })
    return
  }
  const payload = verifyAdminSession(token)
  if (!payload) {
    res.status(401).json({ success: false, error: 'ADMIN_UNAUTHENTICATED' })
    return
  }
  ;(req as AdminAuthedRequest).admin = payload
  next()
}

