import { create } from 'zustand'
import { apiGet } from '../utils/api'

type MeState = {
  loading: boolean
  error: string | null
  user: { id: string; email: string | null; phone: string | null; authProvider: string; displayName: string | null } | null
  google: { status: string; scopes: { gmailReadonly: boolean; calendarReadonly: boolean; contactsReadonly: boolean } } | null
  apiKeyPrefix: string | null
  refresh: () => Promise<void>
  clear: () => void
}

export const useMeStore = create<MeState>((set) => ({
  loading: false,
  error: null,
  user: null,
  google: null,
  apiKeyPrefix: null,
  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const data = await apiGet<{
        user: { id: string; email: string | null; phone: string | null; authProvider: string; displayName: string | null }
        google: { status: string; scopes: { gmailReadonly: boolean; calendarReadonly: boolean; contactsReadonly: boolean } }
        apiKey: { prefix: string } | null
      }>('/api/me')
      set({
        loading: false,
        user: data.user,
        google: data.google,
        apiKeyPrefix: data.apiKey?.prefix ?? null,
      })
    } catch (e) {
      set({ loading: false, error: String((e as Error).message || 'ERROR'), user: null, google: null, apiKeyPrefix: null })
    }
  },
  clear: () => set({ user: null, google: null, apiKeyPrefix: null, error: null, loading: false }),
}))
