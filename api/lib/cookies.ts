import type { Response, Request } from 'express'
import { isProd } from './env.js'

export type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  path?: string
  maxAgeSeconds?: number
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  const parts = header.split(';')
  for (const p of parts) {
    const idx = p.indexOf('=')
    if (idx === -1) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    if (!k) continue
    out[k] = decodeURIComponent(v)
  }
  return out
}

export function setCookie(res: Response, name: string, value: string, opts: CookieOptions = {}) {
  const secure = opts.secure ?? isProd()
  const httpOnly = opts.httpOnly ?? true
  const sameSite = opts.sameSite ?? 'lax'
  const path = opts.path ?? '/'
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`]
  if (httpOnly) parts.push('HttpOnly')
  if (secure) parts.push('Secure')
  parts.push(`SameSite=${sameSite}`)
  if (typeof opts.maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`)
  }
  const existing = res.getHeader('Set-Cookie')
  const next = parts.join('; ')
  if (!existing) {
    res.setHeader('Set-Cookie', next)
    return
  }
  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, next])
    return
  }
  res.setHeader('Set-Cookie', [String(existing), next])
}

export function clearCookie(res: Response, name: string) {
  setCookie(res, name, '', { maxAgeSeconds: 0 })
}

