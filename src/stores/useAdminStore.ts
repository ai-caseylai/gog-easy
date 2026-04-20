import { create } from 'zustand'
import type { AdminUser } from '../mocks/adminTypes'
import { adminApi } from '../mocks/adminApi'
import { apiGet, apiPost } from '../utils/api'

type AdminState = {
  loading: boolean
  error: string | null
  hydrated: boolean
  user: AdminUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hydrate: () => Promise<void>
}

export const useAdminStore = create<AdminState>((set, get) => ({
  loading: false,
  error: null,
  hydrated: false,
  user: null,
  hydrate: async () => {
    set({ loading: true, error: null })
    try {
      const out = await apiGet<{ user: { email: string; role: 'admin' | 'super_admin' } }>('/api/admin/auth/me')
      set({
        user: { id: `admin:${out.user.email}`, email: out.user.email, role: out.user.role },
        error: null,
        loading: false,
        hydrated: true,
      })
      return
    } catch {
      const u = adminApi.getSession()
      set({ user: u, error: null, loading: false, hydrated: true })
    }
  },
  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      try {
        const out = await apiPost<{ user: { email: string; role: 'admin' | 'super_admin' } }>('/api/admin/auth/login', { email, password })
        const u: AdminUser = { id: `admin:${out.user.email}`, email: out.user.email, role: out.user.role }
        set({ user: u, loading: false, error: null, hydrated: true })
        return
      } catch {
        const u = await adminApi.login({ email, password })
        set({ user: u, loading: false, error: null, hydrated: true })
        return
      }
    } catch (e) {
      set({ user: null, loading: false, error: String((e as Error).message || 'ERROR'), hydrated: true })
    }
  },
  logout: () => {
    adminApi.logout()
    void apiPost('/api/admin/auth/logout')
    set({ user: null, error: null, loading: false, hydrated: true })
    void get().hydrate()
  },
}))
