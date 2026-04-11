import type { NextFunction, Request, Response } from 'express'
import { mustGetEnv } from '../lib/env.js'
import { sha256Hex } from '../lib/crypto.js'
import { findActiveApiKeyOwner, getGoogleConnectionByUserId } from '../lib/repo.js'

export type ApiKeyAuthedRequest = Request & { userId: string }

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = String(req.headers['x-api-key'] || '').trim()
  if (!key) {
    res.status(401).json({ success: false, error: 'MISSING_API_KEY' })
    return
  }
  const salt = mustGetEnv('API_KEY_SALT')
  const keyHash = sha256Hex(`${salt}:${key}`)
  const userId = await findActiveApiKeyOwner(keyHash)
  if (!userId) {
    res.status(401).json({ success: false, error: 'INVALID_API_KEY' })
    return
  }
  const conn = await getGoogleConnectionByUserId(userId)
  if (!conn || conn.status !== 'connected') {
    res.status(403).json({ success: false, error: 'GOOGLE_NOT_CONNECTED' })
    return
  }
  ;(req as ApiKeyAuthedRequest).userId = userId
  next()
}

