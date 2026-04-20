import { Router, type Request, type Response } from 'express'
import { requireSession, type AuthedRequest } from '../middleware/sessionAuth.js'
import {
  getUserById,
  upsertAgentRegistration,
  getAgentByPhoneDomain,
  updateAgentHeartbeat,
  updateAgentQr,
} from '../lib/repo.js'

async function getPhone(userId: string): Promise<string> {
  const user = await getUserById(userId)
  return user?.phone || ''
}

const router = Router()

router.post('/register', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
    const qrText = typeof req.body?.qrText === 'string' ? req.body.qrText.trim() : undefined
    const sshHost = typeof req.body?.sshHost === 'string' ? req.body.sshHost.trim() : undefined
    const sshPort = typeof req.body?.sshPort === 'number' ? req.body.sshPort : undefined

    if (!domain) {
      res.status(400).json({ success: false, error: 'MISSING_DOMAIN' })
      return
    }

    const phone = await getPhone(userId)
    if (!phone) {
      res.status(400).json({ success: false, error: 'MISSING_PHONE' })
      return
    }

    const agent = await upsertAgentRegistration({
      phone,
      domain,
      qr_text: qrText,
      ssh_host: sshHost,
      ssh_port: sshPort,
    })

    res.json({ success: true, agent: { id: agent.id, phone: agent.phone, domain: agent.domain, status: agent.status } })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/heartbeat', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
    const phone = await getPhone(userId)
    if (!phone || !domain) {
      res.status(400).json({ success: false, error: 'MISSING_PHONE_OR_DOMAIN' })
      return
    }
    await updateAgentHeartbeat(phone, domain)
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/qr', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : ''
    const qrText = typeof req.body?.qrText === 'string' ? req.body.qrText.trim() : ''
    const phone = await getPhone(userId)
    if (!phone || !domain || !qrText) {
      res.status(400).json({ success: false, error: 'MISSING_PHONE_DOMAIN_OR_QR' })
      return
    }
    await updateAgentQr(phone, domain, qrText)
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/settings', requireSession, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthedRequest).userId
    const domain = typeof req.query.domain === 'string' ? req.query.domain.trim() : ''
    const phone = await getPhone(userId)
    if (!phone || !domain) {
      res.status(400).json({ success: false, error: 'MISSING_PHONE_OR_DOMAIN' })
      return
    }
    const agent = await getAgentByPhoneDomain(phone, domain)
    if (!agent) {
      res.status(404).json({ success: false, error: 'AGENT_NOT_FOUND' })
      return
    }
    res.json({
      success: true,
      llm_primary: agent.llm_primary || {},
      llm_secondary: agent.llm_secondary || {},
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

export default router
