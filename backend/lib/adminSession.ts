import { base64UrlEncode, base64UrlDecode, hmacSha256Base64Url } from './crypto.js'
import { mustGetEnv } from './env.js'
import type { Response } from 'express'
import { clearCookie, setCookie } from './cookies.js'

const ADMIN_COOKIE_NAME = 'gog_admin_session'

export type AdminRole = 'super_admin' | 'admin'

export type AdminSessionPayload = {
  email: string
  role: AdminRole
  iat: number
}

export function adminCookieName(): string {
  return ADMIN_COOKIE_NAME
}

export function signAdminSession(payload: { email: string; role: AdminRole }): string {
  const secret = mustGetEnv('SESSION_SECRET')
  const data: AdminSessionPayload = { email: payload.email, role: payload.role, iat: Math.floor(Date.now() / 1000) }
  const raw = Buffer.from(JSON.stringify(data), 'utf8')
  const body = base64UrlEncode(raw)
  const sig = hmacSha256Base64Url(secret, body)
  return `${body}.${sig}`
}

export function verifyAdminSession(token: string): AdminSessionPayload | null {
  const secret = mustGetEnv('SESSION_SECRET')
  const idx = token.lastIndexOf('.')
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = hmacSha256Base64Url(secret, body)
  if (sig !== expected) return null
  try {
    const json = base64UrlDecode(body).toString('utf8')
    const data = JSON.parse(json) as AdminSessionPayload
    if (!data?.email || (data.role !== 'admin' && data.role !== 'super_admin')) return null
    return data
  } catch {
    return null
  }
}

export function setAdminSessionCookie(res: Response, token: string) {
  setCookie(res, adminCookieName(), token, { httpOnly: true, sameSite: 'lax', path: '/', maxAgeSeconds: 60 * 60 * 12 })
}

export function clearAdminSessionCookie(res: Response) {
  clearCookie(res, adminCookieName())
}

