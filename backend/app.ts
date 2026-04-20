/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import oauthGoogleRoutes from './routes/oauthGoogle.js'
import meRoutes from './routes/me.js'
import apiKeyRoutes from './routes/apiKeys.js'
import connectionRoutes from './routes/connections.js'
import testRoutes from './routes/test.js'
import v1Routes from './routes/v1.js'
import setupRoutes from './routes/setup.js'
import phoneAuthRoutes from './routes/phoneAuth.js'
import twilioRoutes from './routes/twilio.js'
import adminTwilioRoutes from './routes/adminTwilio.js'
import openclawSettingsRoutes from './routes/openclawSettings.js'
import profileRoutes from './routes/profile.js'
import adminAuthRoutes from './routes/adminAuth.js'
import adminSshRoutes from './routes/adminSsh.js'
import adminUsersRoutes from './routes/adminUsers.js'

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/oauth/google', oauthGoogleRoutes)
app.use('/api/me', meRoutes)
app.use('/api/api-keys', apiKeyRoutes)
app.use('/api/connections', connectionRoutes)
app.use('/api/test', testRoutes)
app.use('/api/setup', setupRoutes)
app.use('/api/auth/phone', phoneAuthRoutes)
app.use('/api/integrations/twilio', twilioRoutes)
app.use('/api/admin/twilio', adminTwilioRoutes)
app.use('/api/openclaw', openclawSettingsRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/admin/auth', adminAuthRoutes)
app.use('/api/admin', adminSshRoutes)
app.use('/api/admin', adminUsersRoutes)

app.use('/v1', v1Routes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  void next
  const id = Math.random().toString(36).slice(2, 10)
  try {
    console.error(`[api-error] id=${id} ${req.method} ${req.originalUrl || req.url} ${String(error?.message || 'ERROR')}`)
    if (error?.stack) console.error(error.stack)
  } catch {
    void 0
  }

  const msg = String(error?.message || '')
  const safe =
    msg.startsWith('Missing env:') ||
    msg.startsWith('ENCRYPTION_KEY') ||
    msg.startsWith('DB ') ||
    msg.startsWith('Invalid encrypted payload')

  res.status(500).json({
    success: false,
    error: safe && msg ? msg : `HTTP_500 (${id})`,
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
