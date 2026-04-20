import { getEnv } from './env.js'
import type { AdminRole } from './adminSession.js'

export type AdminUserCredential = {
  email: string
  password: string
  role: AdminRole
}

export function getAdminUsers(): AdminUserCredential[] {
  const raw = getEnv('ADMIN_USERS_JSON')
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const out: AdminUserCredential[] = []
        for (const x of parsed) {
          if (!x || typeof x !== 'object') continue
          const o = x as { email?: unknown; password?: unknown; role?: unknown }
          const email = typeof o.email === 'string' ? o.email.trim().toLowerCase() : ''
          const password = typeof o.password === 'string' ? o.password : ''
          const role = o.role === 'super_admin' ? 'super_admin' : o.role === 'admin' ? 'admin' : null
          if (!email || !password || !role) continue
          out.push({ email, password, role })
        }
        if (out.length > 0) return out
      }
    } catch {
      return defaultUsers()
    }
  }
  return defaultUsers()
}

function defaultUsers(): AdminUserCredential[] {
  return [
    { email: 'superadmin@example.com', password: 'admin123', role: 'super_admin' },
    { email: 'admin@example.com', password: 'admin123', role: 'admin' },
  ]
}

