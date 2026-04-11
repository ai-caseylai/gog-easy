import crypto from 'crypto'

export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64')
}

export function randomBase64Url(bytes = 32): string {
  return base64UrlEncode(crypto.randomBytes(bytes))
}

export function sha256Base64Url(input: string): string {
  return base64UrlEncode(crypto.createHash('sha256').update(input).digest())
}

export function hmacSha256Base64Url(secret: string, input: string): string {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(input).digest())
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function encryptAes256Gcm(plainText: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes base64')
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(ciphertext)].join('.')
}

export function decryptAes256Gcm(payload: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes base64')
  }
  const parts = payload.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = base64UrlDecode(parts[0])
  const tag = base64UrlDecode(parts[1])
  const ciphertext = base64UrlDecode(parts[2])
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plain.toString('utf8')
}

