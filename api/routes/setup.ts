import { Router, type Request, type Response } from 'express'
import { getEnv } from '../lib/env.js'

const router = Router()

function appBaseUrl(): string {
  return getEnv('APP_BASE_URL') || 'http://localhost:5173'
}

function redirectUrl(): string {
  return getEnv('GOOGLE_REDIRECT_URL') || 'http://localhost:3001/api/oauth/google/callback'
}

router.get('/status', (req: Request, res: Response) => {
  void req
  const url = getEnv('SUPABASE_URL')
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  const googleId = getEnv('GOOGLE_CLIENT_ID')
  const googleSecret = getEnv('GOOGLE_CLIENT_SECRET')

  res.json({
    success: true,
    appBaseUrl: appBaseUrl(),
    redirectUrl: redirectUrl(),
    hasGoogleClientId: Boolean(googleId),
    hasGoogleClientSecret: Boolean(googleSecret),
    hasSupabaseUrl: Boolean(url),
    hasSupabaseServiceRoleKey: Boolean(serviceKey),
  })
})

router.get('/env-required', (req: Request, res: Response) => {
  void req
  const names = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'APP_BASE_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URL',
    'SESSION_SECRET',
    'ENCRYPTION_KEY',
    'API_KEY_SALT',
  ]

  const missing = names.filter((n) => !getEnv(n))
  res.json({ success: true, missing })
})

router.get('/redirect-uri', (req: Request, res: Response) => {
  void req
  const base = appBaseUrl()
  const api = getEnv('GOOGLE_REDIRECT_URL')
  const computed = `${base.replace(/\/$/, '')}/api/oauth/google/callback`
  res.json({
    success: true,
    configured: api || null,
    computed,
  })
})

export default router
