import { Router, type Request, type Response } from 'express'
import { requireAdmin } from '../middleware/adminAuth.js'
import { listAgentRegistrations, getAgentRegistration, updateAgentRegistration } from '../lib/repo.js'
import { decryptAes256Gcm } from '../lib/crypto.js'
import { mustGetEnv } from '../lib/env.js'
import { Client } from 'ssh2'

const router = Router()

router.use(requireAdmin)

router.get('/', async (_req: Request, res: Response) => {
  try {
    const agents = await listAgentRegistrations()
    res.json({ success: true, agents })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await getAgentRegistration(req.params.id)
    if (!agent) {
      res.status(404).json({ success: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ success: true, agent })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/:id/push-llm', async (req: Request, res: Response) => {
  try {
    const agent = await getAgentRegistration(req.params.id)
    if (!agent) {
      res.status(404).json({ success: false, error: 'AGENT_NOT_FOUND' })
      return
    }
    if (!agent.ssh_host) {
      res.status(400).json({ success: false, error: 'NO_SSH_HOST' })
      return
    }

    const primary = agent.llm_primary || {}
    const secondary = agent.llm_secondary || {}

    const envLines: string[] = []
    envLines.push(`LLM_PROVIDER_ID=${primary.providerId || ''}`)
    envLines.push(`LLM_MODEL=${primary.model || ''}`)
    envLines.push(`LLM_API_KEY=${primary.apiKey || ''}`)
    envLines.push(`LLM2_PROVIDER_ID=${secondary.providerId || ''}`)
    envLines.push(`LLM2_MODEL=${secondary.model || ''}`)
    envLines.push(`LLM2_API_KEY=${secondary.apiKey || ''}`)
    const envContent = envLines.join('\n')

    const commands = [
      `cat > /tmp/agent-llm.env << 'ENVEOF'\n${envContent}\nENVEOF`,
      `cp /tmp/agent-llm.env /opt/openclaw/.env.llm 2>/dev/null || cp /tmp/agent-llm.env ~/agent-llm.env`,
      `systemctl restart openclaw 2>/dev/null || pm2 restart openclaw 2>/dev/null || true`,
    ]

    let sshPassword = ''
    if (agent.ssh_password_encrypted) {
      try {
        sshPassword = decryptAes256Gcm(agent.ssh_password_encrypted, mustGetEnv('ENCRYPTION_KEY'))
      } catch { /* empty */ }
    }

    const result = await sshExec({
      host: agent.ssh_host,
      port: agent.ssh_port,
      username: agent.ssh_user,
      password: sshPassword || undefined,
    }, commands.join(' && '))

    res.json({ success: true, output: result })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.post('/:id/pull-llm', async (req: Request, res: Response) => {
  try {
    const agent = await getAgentRegistration(req.params.id)
    if (!agent) {
      res.status(404).json({ success: false, error: 'NOT_FOUND' })
      return
    }
    res.json({
      success: true,
      pull_url: `/api/agents/settings?phone=${encodeURIComponent(agent.phone)}&domain=${encodeURIComponent(agent.domain)}`,
      llm_primary: agent.llm_primary || {},
      llm_secondary: agent.llm_secondary || {},
    })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const allowed = ['llm_primary', 'llm_secondary', 'ssh_host', 'ssh_port', 'ssh_user', 'ssh_password_encrypted', 'status']
    const updates: Record<string, unknown> = {}
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, error: 'NO_FIELDS' })
      return
    }
    const agent = await updateAgentRegistration(req.params.id, updates)
    res.json({ success: true, agent })
  } catch (e) {
    res.status(400).json({ success: false, error: String((e as Error).message || 'ERROR') })
  }
})

function sshExec(connOpts: { host: string; port: number; username: string; password?: string }, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); reject(err); return }
        let out = ''
        stream.on('data', (data: Buffer) => { out += data.toString() })
        stream.stderr.on('data', (data: Buffer) => { out += data.toString() })
        stream.on('close', () => { conn.end(); resolve(out) })
      })
    })
    conn.on('error', (err: Error) => reject(err))
    conn.connect({
      host: connOpts.host,
      port: connOpts.port,
      username: connOpts.username,
      password: connOpts.password,
      readyTimeout: 15000,
    })
  })
}

export default router
