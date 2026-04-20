import crypto from 'crypto'

export type PasswordHash = {
  algo: 'scrypt'
  N: number
  r: number
  p: number
  saltB64: string
  hashB64: string
}

function b64(buf: Buffer): string {
  return buf.toString('base64')
}

function unb64(s: string): Buffer {
  return Buffer.from(s, 'base64')
}

export function hashPassword(password: string): string {
  const pw = password
  if (!pw || pw.length < 8) throw new Error('PASSWORD_TOO_SHORT')

  const salt = crypto.randomBytes(16)
  const N = 16384
  const r = 8
  const p = 1

  const hash = crypto.scryptSync(pw, salt, 32, { N, r, p })
  const out: PasswordHash = { algo: 'scrypt', N, r, p, saltB64: b64(salt), hashB64: b64(hash) }
  return `${out.algo}$${out.N}$${out.r}$${out.p}$${out.saltB64}$${out.hashB64}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const pw = password
  const parts = stored.split('$')
  if (parts.length !== 6) return false
  const [algo, nStr, rStr, pStr, saltB64, hashB64] = parts
  if (algo !== 'scrypt') return false
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false
  const salt = unb64(saltB64)
  const expected = unb64(hashB64)
  const got = crypto.scryptSync(pw, salt, expected.length, { N, r, p })
  return crypto.timingSafeEqual(expected, got)
}

