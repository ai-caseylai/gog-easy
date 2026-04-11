import type { NextFunction, Request, Response } from 'express'
import { parseCookies } from '../lib/cookies.js'
import { sessionCookieName, verifySession } from '../lib/session.js'

export type AuthedRequest = Request & { userId: string }

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req)
  const token = cookies[sessionCookieName()]
  if (!token) {
    res.status(401).json({ success: false, error: 'UNAUTHENTICATED' })
    return
  }
  const payload = verifySession(token)
  if (!payload) {
    res.status(401).json({ success: false, error: 'UNAUTHENTICATED' })
    return
  }
  ;(req as AuthedRequest).userId = payload.uid
  next()
}

