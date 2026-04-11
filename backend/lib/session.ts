import { base64UrlEncode, base64UrlDecode, hmacSha256Base64Url } from './crypto.js'
import { mustGetEnv } from './env.js'

const COOKIE_NAME = 'gog_session'

export function sessionCookieName(): string {
  return COOKIE_NAME
}

export type SessionPayload = {
  uid: string
  iat: number
}

export function signSession(uid: string): string {
  const secret = mustGetEnv('SESSION_SECRET')
  const payload: SessionPayload = { uid, iat: Math.floor(Date.now() / 1000) }
  const raw = Buffer.from(JSON.stringify(payload), 'utf8')
  const body = base64UrlEncode(raw)
  const sig = hmacSha256Base64Url(secret, body)
  return `${body}.${sig}`
}

export function verifySession(token: string): SessionPayload | null {
  const secret = mustGetEnv('SESSION_SECRET')
  const idx = token.lastIndexOf('.')
  if (idx === -1) return null
  const body = token.slice(0, idx)
  const sig = token.slice(idx + 1)
  const expected = hmacSha256Base64Url(secret, body)
  if (sig !== expected) return null
  try {
    const json = base64UrlDecode(body).toString('utf8')
    const data = JSON.parse(json) as SessionPayload
    if (!data?.uid) return null
    return data
  } catch {
    return null
  }
}

