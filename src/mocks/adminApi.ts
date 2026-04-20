import type { AdminRole, AdminUser, AuditAction, AuditLog, AuditTarget, Inventory, InventoryHost, VM, VMStatus } from './adminTypes'

type Db = {
  vms: VM[]
  inventories: Inventory[]
  hosts: InventoryHost[]
  audit: AuditLog[]
}

type LoginInput = { email: string; password: string }

const STORAGE_DB_KEY = 'admin_mock_db_v4'
const STORAGE_SESSION_KEY = 'admin_mock_session_v4'

const CREDENTIALS: Array<{ email: string; password: string; role: AdminRole }> = [
  { email: 'superadmin@example.com', password: 'admin123', role: 'super_admin' },
  { email: 'admin@example.com', password: 'admin123', role: 'admin' },
]

function nowIso(): string {
  return new Date().toISOString()
}

function id(prefix: string): string {
  try {
    return crypto.randomUUID()
  } catch {
    const r = Math.random().toString(16).slice(2, 10)
    return `${prefix}_${Date.now().toString(16)}_${r}`
  }
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function seedDb(): Db {
  const t = nowIso()
  const vmId = 'a0881882-840b-4c10-a435-8e6ee761d3c7'
  const vms: VM[] = [
    {
      id: vmId,
      name: 'openClaw#3 for Casey',
      provider: 'vmi3189491',
      ip_address: '167.86.107.166',
      status: 'running',
      tags: ['openclaw', 'casey'],
      notes: 'VNC: 161.97.70.67:63291',
      created_at: t,
      updated_at: t,
    },
  ]
  return { vms, inventories: [], hosts: [], audit: [] }
}

function loadDb(): Db {
  const parsed = safeParseJson<Db>(localStorage.getItem(STORAGE_DB_KEY))
  if (parsed && Array.isArray(parsed.vms) && Array.isArray(parsed.inventories) && Array.isArray(parsed.hosts) && Array.isArray(parsed.audit)) return parsed
  const db = seedDb()
  localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db))
  return db
}

function saveDb(db: Db) {
  localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db))
}

function log(db: Db, actor: AdminUser, action: AuditAction, target_type: AuditTarget, target_id: string) {
  const entry: AuditLog = {
    id: id('audit'),
    actor_user_id: actor.id,
    actor_email: actor.email,
    action,
    target_type,
    target_id,
    created_at: nowIso(),
  }
  db.audit = [entry, ...db.audit].slice(0, 200)
}

function requireRole(user: AdminUser | null): AdminUser {
  if (!user) throw new Error('UNAUTHORIZED')
  if (user.role !== 'admin' && user.role !== 'super_admin') throw new Error('FORBIDDEN')
  return user
}

function matchesQuery(hay: string, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  return hay.toLowerCase().includes(s)
}

export const adminApi = {
  getMockAccounts(): Array<{ email: string; role: AdminRole; passwordHint: string }> {
    return CREDENTIALS.map((c) => ({ email: c.email, role: c.role, passwordHint: c.password }))
  },

  getSession(): AdminUser | null {
    return safeParseJson<AdminUser>(localStorage.getItem(STORAGE_SESSION_KEY))
  },

  logout() {
    localStorage.removeItem(STORAGE_SESSION_KEY)
  },

  async login(input: LoginInput): Promise<AdminUser> {
    const email = input.email.trim().toLowerCase()
    const pw = input.password
    const found = CREDENTIALS.find((c) => c.email === email && c.password === pw)
    if (!found) throw new Error('INVALID_CREDENTIALS')
    const u: AdminUser = { id: id('admin'), email, role: found.role }
    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(u))
    return u
  },

  async listVms(user: AdminUser | null, query: string): Promise<VM[]> {
    requireRole(user)
    const db = loadDb()
    const out = db.vms
      .filter((v) => matchesQuery(`${v.id} ${v.name} ${v.ip_address || ''} ${v.provider || ''} ${(v.tags || []).join(' ')} ${v.status}`, query))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    return out
  },

  async getVm(user: AdminUser | null, idOr: string): Promise<VM> {
    requireRole(user)
    const db = loadDb()
    const v = db.vms.find((x) => x.id === idOr)
    if (!v) throw new Error('NOT_FOUND')
    return v
  },

  async createVm(user: AdminUser | null, input: Partial<VM> & { name: string }): Promise<VM> {
    const actor = requireRole(user)
    if (!input.name?.trim()) throw new Error('VALIDATION_NAME_REQUIRED')
    const db = loadDb()
    const t = nowIso()
    const v: VM = {
      id: id('vm'),
      name: input.name.trim(),
      provider: input.provider?.trim() || undefined,
      ip_address: input.ip_address?.trim() || undefined,
      status: (input.status as VMStatus) || 'unknown',
      tags: Array.isArray(input.tags) ? input.tags.filter(Boolean) : [],
      notes: input.notes?.trim() || undefined,
      created_at: t,
      updated_at: t,
    }
    db.vms = [v, ...db.vms]
    log(db, actor, 'create', 'vm', v.id)
    saveDb(db)
    return v
  },

  async updateVm(user: AdminUser | null, vmId: string, patch: Partial<VM>): Promise<VM> {
    const actor = requireRole(user)
    const db = loadDb()
    const idx = db.vms.findIndex((x) => x.id === vmId)
    if (idx < 0) throw new Error('NOT_FOUND')
    const prev = db.vms[idx]
    const next: VM = {
      ...prev,
      name: typeof patch.name === 'string' ? patch.name.trim() : prev.name,
      provider: typeof patch.provider === 'string' ? (patch.provider.trim() || undefined) : prev.provider,
      ip_address: typeof patch.ip_address === 'string' ? (patch.ip_address.trim() || undefined) : prev.ip_address,
      status: (patch.status as VMStatus) || prev.status,
      tags: Array.isArray(patch.tags) ? patch.tags.filter(Boolean) : prev.tags,
      notes: typeof patch.notes === 'string' ? (patch.notes.trim() || undefined) : prev.notes,
      updated_at: nowIso(),
    }
    if (!next.name.trim()) throw new Error('VALIDATION_NAME_REQUIRED')
    db.vms[idx] = next
    log(db, actor, 'update', 'vm', next.id)
    saveDb(db)
    return next
  },

  async deleteVm(user: AdminUser | null, vmId: string): Promise<void> {
    const actor = requireRole(user)
    const db = loadDb()
    const exists = db.vms.some((x) => x.id === vmId)
    if (!exists) throw new Error('NOT_FOUND')
    db.vms = db.vms.filter((x) => x.id !== vmId)
    db.hosts = db.hosts.map((h) => (h.vm_id === vmId ? { ...h, vm_id: undefined, updated_at: nowIso() } : h))
    log(db, actor, 'delete', 'vm', vmId)
    saveDb(db)
  },

  async listInventories(user: AdminUser | null, query: string): Promise<Array<Inventory & { hostsCount: number }>> {
    requireRole(user)
    const db = loadDb()
    const out = db.inventories
      .filter((i) => matchesQuery(`${i.id} ${i.name} ${i.description || ''}`, query))
      .map((i) => ({ ...i, hostsCount: db.hosts.filter((h) => h.inventory_id === i.id).length }))
      .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    return out
  },

  async getInventory(user: AdminUser | null, inventoryId: string): Promise<Inventory> {
    requireRole(user)
    const db = loadDb()
    const i = db.inventories.find((x) => x.id === inventoryId)
    if (!i) throw new Error('NOT_FOUND')
    return i
  },

  async createInventory(user: AdminUser | null, input: { name: string; description?: string; vars?: Record<string, unknown> }): Promise<Inventory> {
    const actor = requireRole(user)
    if (!input.name?.trim()) throw new Error('VALIDATION_NAME_REQUIRED')
    const db = loadDb()
    const t = nowIso()
    const inv: Inventory = {
      id: id('inv'),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      vars: input.vars || {},
      created_at: t,
      updated_at: t,
    }
    db.inventories = [inv, ...db.inventories]
    log(db, actor, 'create', 'inventory', inv.id)
    saveDb(db)
    return inv
  },

  async updateInventory(user: AdminUser | null, inventoryId: string, patch: Partial<Inventory>): Promise<Inventory> {
    const actor = requireRole(user)
    const db = loadDb()
    const idx = db.inventories.findIndex((x) => x.id === inventoryId)
    if (idx < 0) throw new Error('NOT_FOUND')
    const prev = db.inventories[idx]
    const next: Inventory = {
      ...prev,
      name: typeof patch.name === 'string' ? patch.name.trim() : prev.name,
      description: typeof patch.description === 'string' ? (patch.description.trim() || undefined) : prev.description,
      vars: patch.vars && typeof patch.vars === 'object' ? (patch.vars as Record<string, unknown>) : prev.vars,
      updated_at: nowIso(),
    }
    if (!next.name.trim()) throw new Error('VALIDATION_NAME_REQUIRED')
    db.inventories[idx] = next
    log(db, actor, 'update', 'inventory', next.id)
    saveDb(db)
    return next
  },

  async deleteInventory(user: AdminUser | null, inventoryId: string): Promise<void> {
    const actor = requireRole(user)
    const db = loadDb()
    const exists = db.inventories.some((x) => x.id === inventoryId)
    if (!exists) throw new Error('NOT_FOUND')
    db.inventories = db.inventories.filter((x) => x.id !== inventoryId)
    db.hosts = db.hosts.filter((h) => h.inventory_id !== inventoryId)
    log(db, actor, 'delete', 'inventory', inventoryId)
    saveDb(db)
  },

  async listHosts(user: AdminUser | null, inventoryId: string): Promise<InventoryHost[]> {
    requireRole(user)
    const db = loadDb()
    return db.hosts.filter((h) => h.inventory_id === inventoryId).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  },

  async upsertHost(
    user: AdminUser | null,
    inventoryId: string,
    input: { id?: string; hostname: string; ansible_host?: string; vm_id?: string; vars: Record<string, unknown> },
  ): Promise<InventoryHost> {
    const actor = requireRole(user)
    if (!input.hostname?.trim()) throw new Error('VALIDATION_HOSTNAME_REQUIRED')
    const db = loadDb()
    const t = nowIso()
    const isUpdate = Boolean(input.id)
    if (isUpdate) {
      const idx = db.hosts.findIndex((h) => h.id === input.id && h.inventory_id === inventoryId)
      if (idx < 0) throw new Error('NOT_FOUND')
      const prev = db.hosts[idx]
      const next: InventoryHost = {
        ...prev,
        hostname: input.hostname.trim(),
        ansible_host: input.ansible_host?.trim() || undefined,
        vm_id: input.vm_id?.trim() || undefined,
        vars: input.vars && typeof input.vars === 'object' ? input.vars : prev.vars,
        updated_at: t,
      }
      db.hosts[idx] = next
      log(db, actor, 'update', 'inventory_host', next.id)
      saveDb(db)
      return next
    }

    const host: InventoryHost = {
      id: id('host'),
      inventory_id: inventoryId,
      hostname: input.hostname.trim(),
      ansible_host: input.ansible_host?.trim() || undefined,
      vm_id: input.vm_id?.trim() || undefined,
      vars: input.vars || {},
      created_at: t,
      updated_at: t,
    }
    db.hosts = [host, ...db.hosts]
    log(db, actor, 'create', 'inventory_host', host.id)
    saveDb(db)
    return host
  },

  async deleteHost(user: AdminUser | null, inventoryId: string, hostId: string): Promise<void> {
    const actor = requireRole(user)
    const db = loadDb()
    const exists = db.hosts.some((h) => h.id === hostId && h.inventory_id === inventoryId)
    if (!exists) throw new Error('NOT_FOUND')
    db.hosts = db.hosts.filter((h) => !(h.id === hostId && h.inventory_id === inventoryId))
    log(db, actor, 'delete', 'inventory_host', hostId)
    saveDb(db)
  },

  async listAudit(user: AdminUser | null, opts: { targetType?: AuditTarget; targetId?: string; limit?: number }): Promise<AuditLog[]> {
    requireRole(user)
    const db = loadDb()
    const limit = typeof opts.limit === 'number' ? Math.max(1, Math.min(200, opts.limit)) : 50
    return db.audit
      .filter((a) => (opts.targetType ? a.target_type === opts.targetType : true))
      .filter((a) => (opts.targetId ? a.target_id === opts.targetId : true))
      .slice(0, limit)
  },
}
