import crypto from 'crypto'
import { decryptAes256Gcm, encryptAes256Gcm, randomBase64Url, sha256Hex } from '../lib/crypto.js'
import { signSession, verifySession } from '../lib/session.js'

process.env.SESSION_SECRET = randomBase64Url(32)
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64')

const plain = 'hello-world'
const enc = encryptAes256Gcm(plain, process.env.ENCRYPTION_KEY)
const dec = decryptAes256Gcm(enc, process.env.ENCRYPTION_KEY)
if (dec !== plain) {
  throw new Error('encrypt/decrypt failed')
}

const token = signSession('user-123')
const payload = verifySession(token)
if (!payload || payload.uid !== 'user-123') {
  throw new Error('session sign/verify failed')
}

const h = sha256Hex('x')
if (h.length !== 64) {
  throw new Error('sha256Hex failed')
}

