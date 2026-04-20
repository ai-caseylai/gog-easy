import { Router, type Request, type Response } from 'express'
import type { CodeChallengeMethod } from 'google-auth-library'
import { mustGetEnv } from '../lib/env.js'
import { randomBase64Url, sha256Base64Url, encryptAes256Gcm } from '../lib/crypto.js'
import { clearCookie, parseCookies, setCookie } from '../lib/cookies.js'
import { googleOAuthClient, googleUserInfo } from '../lib/google.js'
import { signSession, sessionCookieName, verifySession } from '../lib/session.js'
import { getGoogleConnectionByUserId, updateUserGoogleInfo, upsertGoogleConnection, upsertUser } from '../lib/repo.js'

const router = Router()

const STATE_COOKIE = 'gog_oauth_state'
const VERIFIER_COOKIE = 'gog_oauth_verifier'

function appBaseUrl(): string {
  return mustGetEnv('APP_BASE_URL')
}

function googleScopes(): string[] {
  return [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/contacts',
  ]
}

function scopesToFlags(scopeString: string | undefined) {
  const scopes = new Set((scopeString || '').split(/\s+/g).filter(Boolean))
  return {
    gmailReadonly:
      scopes.has('https://www.googleapis.com/auth/gmail.readonly') ||
      scopes.has('https://www.googleapis.com/auth/gmail.modify') ||
      scopes.has('https://www.googleapis.com/auth/gmail.send'),
    calendarReadonly:
      scopes.has('https://www.googleapis.com/auth/calendar.readonly') ||
      scopes.has('https://www.googleapis.com/auth/calendar.events'),
    contactsReadonly:
      scopes.has('https://www.googleapis.com/auth/contacts.readonly') ||
      scopes.has('https://www.googleapis.com/auth/contacts'),
  }
}

router.get('/start', async (req: Request, res: Response) => {
  try {
    const state = randomBase64Url(16)
    const verifier = randomBase64Url(32)
    const challenge = sha256Base64Url(verifier)

    setCookie(res, STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', maxAgeSeconds: 600 })
    setCookie(res, VERIFIER_COOKIE, verifier, { httpOnly: true, sameSite: 'lax', maxAgeSeconds: 600 })

    const client = googleOAuthClient()
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      response_type: 'code',
      scope: googleScopes(),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256' as CodeChallengeMethod,
    })

    res.redirect(url)
  } catch {
    res.redirect(`${appBaseUrl()}/oauth/processing?status=error&code=missing_google_env`)
  }
})

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code || '')
    const state = String(req.query.state || '')
    const cookies = parseCookies(req)
    const expectedState = cookies[STATE_COOKIE]
    const verifier = cookies[VERIFIER_COOKIE]

    clearCookie(res, STATE_COOKIE)
    clearCookie(res, VERIFIER_COOKIE)

    if (!code || !state || !expectedState || state !== expectedState || !verifier) {
      res.redirect(`${appBaseUrl()}/oauth/processing?status=error&code=oauth_state`)
      return
    }

    const client = googleOAuthClient()
    const { tokens } = await client.getToken({ code, codeVerifier: verifier })
    const accessToken = tokens.access_token
    if (!accessToken) {
      res.redirect(`${appBaseUrl()}/oauth/processing?status=error&code=oauth_token`)
      return
    }

    const info = await googleUserInfo(accessToken)
    const existingSession = cookies[sessionCookieName()]
    const sessionPayload = existingSession ? verifySession(existingSession) : null
    const user = sessionPayload
      ? await updateUserGoogleInfo({
          user_id: sessionPayload.uid,
          google_sub: info.sub,
          email: info.email,
          display_name: info.name ?? null,
        })
      : await upsertUser({
          google_sub: info.sub,
          email: info.email,
          display_name: info.name ?? null,
        })

    const encryptionKey = mustGetEnv('ENCRYPTION_KEY')
    const existingConn = await getGoogleConnectionByUserId(user.id)
    const refreshToken = tokens.refresh_token
    const refreshEncrypted = refreshToken
      ? encryptAes256Gcm(refreshToken, encryptionKey)
      : existingConn?.refresh_token_encrypted

    if (!refreshEncrypted) {
      res.redirect(`${appBaseUrl()}/oauth/processing?status=error&code=no_refresh_token`)
      return
    }

    await upsertGoogleConnection({
      user_id: user.id,
      status: 'connected',
      scopes: scopesToFlags(tokens.scope),
      refresh_token_encrypted: refreshEncrypted,
    })

    const session = signSession(user.id)
    setCookie(res, sessionCookieName(), session, { httpOnly: true, sameSite: 'lax', maxAgeSeconds: 60 * 60 * 24 * 30 })

    res.redirect(`${appBaseUrl()}/oauth/processing?status=success`)
  } catch {
    res.redirect(`${appBaseUrl()}/oauth/processing?status=error&code=oauth_unknown`)
  }
})

export default router
