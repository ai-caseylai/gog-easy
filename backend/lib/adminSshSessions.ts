import crypto from 'crypto'

export type SshAuth =
  | { type: 'password'; username: string; password: string }
  | { type: 'privateKey'; username: string; privateKeyPem: string; passphrase?: string }

export type AdminSshSession = {
  id: string
  createdAt: number
  expiresAt: number
  actorEmail: string
  vmId: string
  host: string
  port: number
  auth: SshAuth
  debug?: boolean
}

export type AdminVncSession = {
  id: string
  createdAt: number
  expiresAt: number
  actorEmail: string
  vmId: string
  host: string
  port: number
  password: string
}

const sessions = new Map<string, AdminSshSession>()
const vncSessions = new Map<string, AdminVncSession>()

export function createAdminSshSession(input: Omit<AdminSshSession, 'id' | 'createdAt' | 'expiresAt'> & { ttlMs?: number }): AdminSshSession {
  const now = Date.now()
  const ttl = typeof input.ttlMs === 'number' ? Math.max(10_000, Math.min(input.ttlMs, 10 * 60_000)) : 2 * 60_000
  const id = crypto.randomUUID()
  const sess: AdminSshSession = {
    id,
    createdAt: now,
    expiresAt: now + ttl,
    actorEmail: input.actorEmail,
    vmId: input.vmId,
    host: input.host,
    port: input.port,
    auth: input.auth,
    debug: input.debug,
  }
  sessions.set(id, sess)
  return sess
}

export function getAdminSshSession(id: string): AdminSshSession | null {
  const s = sessions.get(id)
  if (!s) return null
  if (Date.now() > s.expiresAt) {
    sessions.delete(id)
    return null
  }
  return s
}

export function deleteAdminSshSession(id: string) {
  sessions.delete(id)
}

export function createAdminVncSession(input: Omit<AdminVncSession, 'id' | 'createdAt' | 'expiresAt'> & { ttlMs?: number }): AdminVncSession {
  const now = Date.now()
  const ttl = typeof input.ttlMs === 'number' ? Math.max(10_000, Math.min(input.ttlMs, 10 * 60_000)) : 2 * 60_000
  const id = crypto.randomUUID()
  const sess: AdminVncSession = {
    id,
    createdAt: now,
    expiresAt: now + ttl,
    actorEmail: input.actorEmail,
    vmId: input.vmId,
    host: input.host,
    port: input.port,
    password: input.password,
  }
  vncSessions.set(id, sess)
  return sess
}

export function getAdminVncSession(id: string): AdminVncSession | null {
  const s = vncSessions.get(id)
  if (!s) return null
  if (Date.now() > s.expiresAt) {
    vncSessions.delete(id)
    return null
  }
  return s
}

export function deleteAdminVncSession(id: string) {
  vncSessions.delete(id)
}
