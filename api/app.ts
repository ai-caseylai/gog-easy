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
  res.status(500).json({
    success: false,
    error: 'Server internal error',
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
