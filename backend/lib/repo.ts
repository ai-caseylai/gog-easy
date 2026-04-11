import { supabaseAdmin } from './supabase.js'

export type DbUser = {
  id: string
  google_sub: string
  email: string
  display_name: string | null
}

export type DbGoogleConnection = {
  id: string
  user_id: string
  status: 'connected' | 'disconnected' | 'error'
  scopes: Record<string, unknown>
  refresh_token_encrypted: string
}

export type DbApiKey = {
  id: string
  user_id: string
  key_prefix: string
  key_hash: string
  status: 'active' | 'revoked'
}

export async function upsertUser(input: {
  google_sub: string
  email: string
  display_name: string | null
}): Promise<DbUser> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .upsert(
      {
        google_sub: input.google_sub,
        email: input.email,
        display_name: input.display_name,
      },
      { onConflict: 'google_sub' },
    )
    .select('id, google_sub, email, display_name')
    .single()

  if (error || !data) {
    throw new Error('DB upsert user failed')
  }
  return data as DbUser
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, google_sub, email, display_name')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('DB get user failed')
  return (data as DbUser) ?? null
}

export async function getUserByGoogleSub(google_sub: string): Promise<DbUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, google_sub, email, display_name')
    .eq('google_sub', google_sub)
    .maybeSingle()
  if (error) throw new Error('DB get user failed')
  return (data as DbUser) ?? null
}

export async function getGoogleConnectionByUserId(user_id: string): Promise<DbGoogleConnection | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('google_connections')
    .select('id, user_id, status, scopes, refresh_token_encrypted')
    .eq('user_id', user_id)
    .maybeSingle()
  if (error) throw new Error('DB get connection failed')
  return (data as DbGoogleConnection) ?? null
}

export async function upsertGoogleConnection(input: {
  user_id: string
  status: 'connected' | 'disconnected' | 'error'
  scopes: Record<string, unknown>
  refresh_token_encrypted: string
}): Promise<DbGoogleConnection> {
  const sb = supabaseAdmin()
  const existing = await getGoogleConnectionByUserId(input.user_id)
  if (existing) {
    const { data, error } = await sb
      .from('google_connections')
      .update({
        status: input.status,
        scopes: input.scopes,
        refresh_token_encrypted: input.refresh_token_encrypted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, user_id, status, scopes, refresh_token_encrypted')
      .single()
    if (error || !data) throw new Error('DB update connection failed')
    return data as DbGoogleConnection
  }

  const { data, error } = await sb
    .from('google_connections')
    .insert({
      user_id: input.user_id,
      status: input.status,
      scopes: input.scopes,
      refresh_token_encrypted: input.refresh_token_encrypted,
    })
    .select('id, user_id, status, scopes, refresh_token_encrypted')
    .single()
  if (error || !data) throw new Error('DB insert connection failed')
  return data as DbGoogleConnection
}

export async function deleteGoogleConnectionByUserId(user_id: string): Promise<void> {
  const sb = supabaseAdmin()
  const { error } = await sb.from('google_connections').delete().eq('user_id', user_id)
  if (error) throw new Error('DB delete connection failed')
}

export async function revokeApiKeysByUserId(user_id: string): Promise<void> {
  const sb = supabaseAdmin()
  const { error } = await sb
    .from('api_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('user_id', user_id)
    .eq('status', 'active')
  if (error) throw new Error('DB revoke api keys failed')
}

export async function insertApiKey(input: {
  user_id: string
  key_prefix: string
  key_hash: string
}): Promise<DbApiKey> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .insert({
      user_id: input.user_id,
      key_prefix: input.key_prefix,
      key_hash: input.key_hash,
      status: 'active',
    })
    .select('id, user_id, key_prefix, key_hash, status')
    .single()
  if (error || !data) throw new Error('DB insert api key failed')
  return data as DbApiKey
}

export async function getActiveApiKeyPrefix(user_id: string): Promise<string | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .select('key_prefix')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('DB get api key failed')
  const prefix = (data as { key_prefix?: string } | null)?.key_prefix
  return prefix ?? null
}

export async function findActiveApiKeyOwner(key_hash: string): Promise<string | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('api_keys')
    .select('user_id')
    .eq('key_hash', key_hash)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new Error('DB find api key failed')
  const uid = (data as { user_id?: string } | null)?.user_id
  return uid ?? null
}

