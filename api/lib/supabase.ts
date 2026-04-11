import { createClient } from '@supabase/supabase-js'
import { mustGetEnv } from './env.js'

export function supabaseAdmin() {
  const url = mustGetEnv('SUPABASE_URL')
  const service = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

