import { Router, type Request, type Response } from 'express'
import type { ApiKeyAuthedRequest } from '../middleware/apiKeyAuth.js'
import { requireApiKey } from '../middleware/apiKeyAuth.js'
import { base64UrlEncode, decryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { calendarClient, gmailClient, peopleClient } from '../lib/google.js'
import { getGoogleConnectionByUserId } from '../lib/repo.js'

const router = Router()

async function refreshTokenForUser(userId: string): Promise<string> {
  const conn = await getGoogleConnectionByUserId(userId)
  if (!conn || conn.status !== 'connected') {
    throw new Error('GOOGLE_NOT_CONNECTED')
  }
  return decryptAes256Gcm(conn.refresh_token_encrypted, mustGetEnv('ENCRYPTION_KEY'))
}

router.get('/gmail/messages', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)
    const q = typeof req.query.query === 'string' ? req.query.query : undefined
    const maxResults = Math.min(50, Math.max(1, Number(req.query.maxResults || 10)))
    const out = await gmail.users.messages.list({ userId: 'me', q, maxResults })
    res.json({ success: true, messages: out.data.messages || [] })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/gmail/messages/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)
    const out = await gmail.users.messages.get({
      userId: 'me',
      id: req.params.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date', 'To'],
    })
    res.json({ success: true, message: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/gmail/send', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)

    const to = typeof req.body?.to === 'string' ? req.body.to : ''
    const subject = typeof req.body?.subject === 'string' ? req.body.subject : ''
    const bodyText = typeof req.body?.bodyText === 'string' ? req.body.bodyText : ''
    const cc = typeof req.body?.cc === 'string' ? req.body.cc : undefined
    const bcc = typeof req.body?.bcc === 'string' ? req.body.bcc : undefined

    if (!to || !subject) {
      res.status(400).json({ success: false, error: 'INVALID_INPUT' })
      return
    }

    const headers = [`To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"']
    if (cc) headers.push(`Cc: ${cc}`)
    if (bcc) headers.push(`Bcc: ${bcc}`)
    const raw = `${headers.join('\r\n')}\r\n\r\n${bodyText}`
    const encoded = base64UrlEncode(Buffer.from(raw, 'utf8'))

    const out = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    })
    res.json({ success: true, message: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/gmail/messages/:id/modify', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)

    const addLabelIds = Array.isArray(req.body?.addLabelIds) ? (req.body.addLabelIds.filter((x: unknown) => typeof x === 'string') as string[]) : undefined
    const removeLabelIds = Array.isArray(req.body?.removeLabelIds)
      ? (req.body.removeLabelIds.filter((x: unknown) => typeof x === 'string') as string[])
      : undefined

    const out = await gmail.users.messages.modify({
      userId: 'me',
      id: req.params.id,
      requestBody: { addLabelIds, removeLabelIds },
    })
    res.json({ success: true, message: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/gmail/messages/:id/trash', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)
    const out = await gmail.users.messages.trash({ userId: 'me', id: req.params.id })
    res.json({ success: true, message: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.delete('/gmail/messages/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const gmail = gmailClient(refresh)
    await gmail.users.messages.delete({ userId: 'me', id: req.params.id })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/calendar/events', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const cal = calendarClient(refresh)
    const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : 'primary'
    const timeMin = typeof req.query.timeMin === 'string' ? req.query.timeMin : new Date().toISOString()
    const timeMax = typeof req.query.timeMax === 'string' ? req.query.timeMax : undefined
    const maxResults = Math.min(50, Math.max(1, Number(req.query.maxResults || 10)))
    const out = await cal.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults,
    })
    res.json({ success: true, events: out.data.items || [] })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/calendar/events', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const cal = calendarClient(refresh)
    const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : 'primary'

    const out = await cal.events.insert({
      calendarId,
      requestBody: req.body ?? {},
    })
    res.json({ success: true, event: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.patch('/calendar/events/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const cal = calendarClient(refresh)
    const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : 'primary'

    const out = await cal.events.patch({
      calendarId,
      eventId: req.params.id,
      requestBody: req.body ?? {},
    })
    res.json({ success: true, event: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.delete('/calendar/events/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const cal = calendarClient(refresh)
    const calendarId = typeof req.query.calendarId === 'string' ? req.query.calendarId : 'primary'

    await cal.events.delete({ calendarId, eventId: req.params.id })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/contacts/search', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const people = peopleClient(refresh)
    const query = typeof req.query.query === 'string' ? req.query.query : ''
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 10)))
    if (query) {
      const out = await people.people.searchContacts({
        query,
        pageSize,
        readMask: 'names,emailAddresses,phoneNumbers',
      })
      res.json({ success: true, results: out.data.results || [] })
      return
    }

    const out = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize,
      personFields: 'names,emailAddresses,phoneNumbers',
    })
    res.json({ success: true, connections: out.data.connections || [] })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/contacts', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const people = peopleClient(refresh)

    const out = await people.people.createContact({ requestBody: req.body ?? {} })
    res.json({ success: true, contact: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.patch('/contacts', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const people = peopleClient(refresh)

    const resourceName = typeof req.query.resourceName === 'string' ? req.query.resourceName : ''
    if (!resourceName) {
      res.status(400).json({ success: false, error: 'INVALID_INPUT' })
      return
    }

    const current = await people.people.get({ resourceName, personFields: 'names,emailAddresses,phoneNumbers' })
    const currentData = (current.data ?? {}) as Record<string, unknown>
    const etag = typeof currentData.etag === 'string' ? currentData.etag : undefined
    const merged: Record<string, unknown> = { ...currentData, ...(req.body ?? {}) }
    if (etag) merged.etag = etag
    merged.resourceName = resourceName

    const updatePersonFields = typeof req.query.updatePersonFields === 'string' ? req.query.updatePersonFields : 'names,emailAddresses,phoneNumbers'
    const out = await people.people.updateContact({
      resourceName,
      updatePersonFields,
      requestBody: merged,
    })
    res.json({ success: true, contact: out.data })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.delete('/contacts', requireApiKey, async (req: Request, res: Response) => {
  try {
    const userId = (req as ApiKeyAuthedRequest).userId
    const refresh = await refreshTokenForUser(userId)
    const people = peopleClient(refresh)

    const resourceName = typeof req.query.resourceName === 'string' ? req.query.resourceName : ''
    if (!resourceName) {
      res.status(400).json({ success: false, error: 'INVALID_INPUT' })
      return
    }
    await people.people.deleteContact({ resourceName })
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router
