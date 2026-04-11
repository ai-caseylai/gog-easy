import { Router, type Response } from 'express'
import type { AuthedRequest } from '../middleware/sessionAuth.js'
import { requireSession } from '../middleware/sessionAuth.js'
import { decryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { calendarClient, gmailClient, peopleClient } from '../lib/google.js'
import { getGoogleConnectionByUserId } from '../lib/repo.js'

const router = Router()

async function getRefreshToken(userId: string): Promise<string> {
  const conn = await getGoogleConnectionByUserId(userId)
  if (!conn || conn.status !== 'connected') {
    throw new Error('GOOGLE_NOT_CONNECTED')
  }
  return decryptAes256Gcm(conn.refresh_token_encrypted, mustGetEnv('ENCRYPTION_KEY'))
}

router.get('/gmail', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const refresh = await getRefreshToken(req.userId)
    const gmail = gmailClient(refresh)
    const list = await gmail.users.messages.list({ userId: 'me', maxResults: 5 })
    const messages = list.data.messages || []
    res.json({ success: true, messages })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/calendar', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const refresh = await getRefreshToken(req.userId)
    const cal = calendarClient(refresh)
    const now = new Date()
    const in7d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const out = await cal.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: in7d.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 5,
    })
    res.json({ success: true, events: out.data.items || [] })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/contacts', requireSession, async (req: AuthedRequest, res: Response) => {
  try {
    const refresh = await getRefreshToken(req.userId)
    const people = peopleClient(refresh)
    const out = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 5,
      personFields: 'names,emailAddresses,phoneNumbers',
    })
    res.json({ success: true, connections: out.data.connections || [] })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router

