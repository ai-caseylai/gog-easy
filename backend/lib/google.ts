import { google } from 'googleapis'
import { mustGetEnv } from './env.js'

export function googleOAuthClient() {
  const clientId = mustGetEnv('GOOGLE_CLIENT_ID')
  const clientSecret = mustGetEnv('GOOGLE_CLIENT_SECRET')
  const redirectUri = mustGetEnv('GOOGLE_REDIRECT_URL')
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function googleUserInfo(accessToken: string): Promise<{ sub: string; email: string; name?: string }>{
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error('Failed to fetch userinfo')
  }
  const json = (await res.json()) as { sub: string; email: string; name?: string }
  if (!json?.sub || !json?.email) {
    throw new Error('Invalid userinfo response')
  }
  return json
}

export function gmailClient(refreshToken: string) {
  const oauth2 = googleOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.gmail({ version: 'v1', auth: oauth2 })
}

export function calendarClient(refreshToken: string) {
  const oauth2 = googleOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth: oauth2 })
}

export function peopleClient(refreshToken: string) {
  const oauth2 = googleOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.people({ version: 'v1', auth: oauth2 })
}

