export type AdminRole = 'super_admin' | 'admin'

export type VMStatus = 'running' | 'stopped' | 'unknown'

export type VM = {
  id: string
  name: string
  provider?: string
  ip_address?: string
  status: VMStatus
  tags: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export type Inventory = {
  id: string
  name: string
  description?: string
  vars: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type InventoryHost = {
  id: string
  inventory_id: string
  hostname: string
  ansible_host?: string
  vm_id?: string
  vars: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AuditAction = 'create' | 'update' | 'delete'
export type AuditTarget = 'vm' | 'inventory' | 'inventory_host'

export type AuditLog = {
  id: string
  actor_user_id: string
  actor_email?: string
  action: AuditAction
  target_type: AuditTarget
  target_id: string
  created_at: string
}

export type AdminUser = {
  id: string
  email: string
  role: AdminRole
}

