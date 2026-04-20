import { Router, type Request, type Response } from 'express'
import { mustGetEnv } from '../lib/env.js'
import { decryptAes256Gcm, encryptAes256Gcm, sha256Hex } from '../lib/crypto.js'
import { requireAdmin, type AdminAuthedRequest } from '../middleware/adminAuth.js'
import { createAdminSshSession, createAdminVncSession } from '../lib/adminSshSessions.js'
import { getVmById, getVmCredential, upsertVm, upsertVmCredential } from '../lib/repo.js'

const router = Router()

router.post('/vms/:id/sync', requireAdmin, async (req: Request, res: Response) => {
  const admin = (req as AdminAuthedRequest).admin
  void admin

  const vmId = String(req.params.id || '').trim()
  const body = req.body as { vm?: { id?: unknown; name?: unknown; provider?: unknown; ip_address?: unknown; status?: unknown; tags?: unknown; notes?: unknown } }
  const vm = body?.vm

  const name = typeof vm?.name === 'string' ? vm.name.trim() : ''
  if (!vmId || !name) {
    res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
    return
  }

  const out = await upsertVm({
    id: vmId,
    name,
    provider: typeof vm?.provider === 'string' ? vm.provider.trim() || null : null,
    ip_address: typeof vm?.ip_address === 'string' ? vm.ip_address.trim() || null : null,
    status: vm?.status === 'running' || vm?.status === 'stopped' || vm?.status === 'unknown' ? vm.status : 'unknown',
    tags: Array.isArray(vm?.tags) ? (vm?.tags as unknown[]).filter((x) => typeof x === 'string').map((x) => String(x)) : [],
    notes: typeof vm?.notes === 'string' ? vm.notes : null,
  })

  res.json({ success: true, vm: out })
})

router.post('/vms/:id/credentials', requireAdmin, async (req: Request, res: Response) => {
  const admin = (req as AdminAuthedRequest).admin
  const vmId = String(req.params.id || '').trim()
  const body = req.body as {
    vm?: { name?: unknown; provider?: unknown; ip_address?: unknown; status?: unknown; tags?: unknown; notes?: unknown }
    kind?: unknown
    username?: unknown
    secret?: unknown
    vncHost?: unknown
    vncPort?: unknown
  }

  const kind = body.kind === 'ssh_password' || body.kind === 'ssh_private_key' || body.kind === 'vnc_password' ? body.kind : null
  const secret = typeof body.secret === 'string' ? body.secret : ''
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const name = typeof body.vm?.name === 'string' ? body.vm.name.trim() : ''

  if (!vmId || !kind || !secret || !name) {
    res.status(400).json({ success: false, error: 'VALIDATION_FAILED' })
    return
  }

  await upsertVm({
    id: vmId,
    name,
    provider: typeof body.vm?.provider === 'string' ? body.vm.provider.trim() || null : null,
    ip_address: typeof body.vm?.ip_address === 'string' ? body.vm.ip_address.trim() || null : null,
    status: body.vm?.status === 'running' || body.vm?.status === 'stopped' || body.vm?.status === 'unknown' ? body.vm.status : 'unknown',
    tags: Array.isArray(body.vm?.tags) ? (body.vm?.tags as unknown[]).filter((x) => typeof x === 'string').map((x) => String(x)) : [],
    notes: typeof body.vm?.notes === 'string' ? body.vm.notes : null,
  })

  const key = mustGetEnv('ENCRYPTION_KEY')
  const encrypted = encryptAes256Gcm(secret, key)
  const hint = sha256Hex(secret).slice(0, 8)

  const meta: Record<string, unknown> = {
    hint,
    username: username || null,
    vncHost: typeof body.vncHost === 'string' ? body.vncHost.trim() || null : null,
    vncPort: typeof body.vncPort === 'number' ? body.vncPort : typeof body.vncPort === 'string' ? Number(body.vncPort) : null,
    updatedBy: admin.email,
    updatedAt: new Date().toISOString(),
  }

  const saved = await upsertVmCredential({ vm_id: vmId, kind, meta, secret_encrypted: encrypted })

  res.json({ success: true, credential: { vm_id: saved.vm_id, kind: saved.kind, meta: saved.meta, updated_at: saved.updated_at } })
})

router.post('/vnc/sessions', requireAdmin, async (req: Request, res: Response) => {
  const admin = (req as AdminAuthedRequest).admin
  const vmId = String((req.body as { vmId?: unknown })?.vmId || '').trim()
  if (!vmId) {
    res.status(400).json({ success: false, error: 'VALIDATION_VM_ID_REQUIRED' })
    return
  }

  const vm = await getVmById(vmId)
  if (!vm) {
    res.status(404).json({ success: false, error: 'NOT_FOUND' })
    return
  }

  const cred = await getVmCredential(vmId, 'vnc_password')
  if (!cred) {
    res.status(400).json({ success: false, error: 'VNC_CREDENTIAL_REQUIRED' })
    return
  }

  const host = typeof cred.meta?.vncHost === 'string' ? String(cred.meta.vncHost).trim() : ''
  const portRaw = cred.meta['vncPort']
  const port = typeof portRaw === 'number' ? portRaw : typeof portRaw === 'string' ? Number(portRaw) : NaN
  if (!host || !Number.isFinite(port) || port <= 0) {
    res.status(400).json({ success: false, error: 'VNC_HOST_PORT_REQUIRED' })
    return
  }

  const key = mustGetEnv('ENCRYPTION_KEY')
  const password = decryptAes256Gcm(cred.secret_encrypted, key)
  const sess = createAdminVncSession({ actorEmail: admin.email, vmId, host, port: Math.floor(port), password })

  res.json({ success: true, sessionId: sess.id })
})

router.post('/ssh/sessions', requireAdmin, async (req: Request, res: Response) => {
  const admin = (req as AdminAuthedRequest).admin
  const body = req.body as {
    vmId?: unknown
    vm?: { name?: unknown; ip_address?: unknown; provider?: unknown; status?: unknown; tags?: unknown; notes?: unknown }
    username?: unknown
    password?: unknown
    ssh2Debug?: unknown
  }
  const vmId = typeof body.vmId === 'string' ? body.vmId.trim() : ''
  if (!vmId) {
    res.status(400).json({ success: false, error: 'VALIDATION_VM_ID_REQUIRED' })
    return
  }

  const existing = await getVmById(vmId)
  if (!existing) {
    const name = typeof body.vm?.name === 'string' ? body.vm.name.trim() : ''
    if (!name) {
      res.status(400).json({ success: false, error: 'VM_NOT_SYNCED' })
      return
    }
    await upsertVm({
      id: vmId,
      name,
      provider: typeof body.vm?.provider === 'string' ? body.vm.provider.trim() || null : null,
      ip_address: typeof body.vm?.ip_address === 'string' ? body.vm.ip_address.trim() || null : null,
      status: body.vm?.status === 'running' || body.vm?.status === 'stopped' || body.vm?.status === 'unknown' ? body.vm.status : 'unknown',
      tags: Array.isArray(body.vm?.tags) ? (body.vm?.tags as unknown[]).filter((x) => typeof x === 'string').map((x) => String(x)) : [],
      notes: typeof body.vm?.notes === 'string' ? body.vm.notes : null,
    })
  }

  const vm = (await getVmById(vmId))
  if (!vm || !vm.ip_address) {
    res.status(400).json({ success: false, error: 'VM_IP_REQUIRED' })
    return
  }

  const overrideUsername = typeof body.username === 'string' ? body.username.trim() : ''
  const overridePassword = typeof body.password === 'string' ? body.password : ''
  const ssh2Debug = body.ssh2Debug === true
  if (overridePassword) {
    const sess = createAdminSshSession({
      actorEmail: admin.email,
      vmId,
      host: vm.ip_address,
      port: 22,
      auth: { type: 'password', username: overrideUsername || 'root', password: overridePassword },
      debug: ssh2Debug,
    })
    res.json({ success: true, sessionId: sess.id, debug: { authSource: 'override', username: overrideUsername || 'root', passwordLen: overridePassword.length } })
    return
  }

  const cred = await getVmCredential(vmId, 'ssh_password')
  if (!cred) {
    res.status(400).json({ success: false, error: 'SSH_CREDENTIAL_REQUIRED' })
    return
  }
  const username = typeof cred.meta?.username === 'string' ? String(cred.meta.username) : 'root'
  const key = mustGetEnv('ENCRYPTION_KEY')
  const password = decryptAes256Gcm(cred.secret_encrypted, key)

  const sess = createAdminSshSession({
    actorEmail: admin.email,
    vmId,
    host: vm.ip_address,
    port: 22,
    auth: { type: 'password', username, password },
    debug: ssh2Debug,
  })

  res.json({ success: true, sessionId: sess.id, debug: { authSource: 'db', username, passwordLen: password.length } })
})

export default router
