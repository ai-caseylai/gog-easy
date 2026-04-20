import { supabaseAdmin } from './supabase.js'

export type DbUser = {
  id: string
  google_sub: string | null
  email: string | null
  phone: string | null
  auth_provider: string
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

export type DbUserSecret = {
  id: string
  user_id: string
  kind: string
  meta: Record<string, unknown>
  secret_encrypted: string
}

export type DbAppSecret = {
  id: string
  kind: string
  meta: Record<string, unknown>
  secret_encrypted: string
}

export type DbVm = {
  id: string
  name: string
  provider: string | null
  ip_address: string | null
  status: 'running' | 'stopped' | 'unknown'
  tags: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export type DbVmCredential = {
  id: string
  vm_id: string
  kind: 'ssh_password' | 'ssh_private_key' | 'vnc_password'
  meta: Record<string, unknown>
  secret_encrypted: string
  created_at: string
  updated_at: string
}

export type DbAdminUser = {
  id: string
  email: string
  role: 'admin' | 'super_admin'
  password_hash: string
  created_at: string
  updated_at: string
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
        auth_provider: 'google',
      },
      { onConflict: 'google_sub' },
    )
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .single()

  if (error || !data) {
    throw new Error('DB upsert user failed')
  }
  return data as DbUser
}

export async function upsertPhoneUser(input: { phone: string }): Promise<DbUser> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .upsert(
      {
        phone: input.phone,
        auth_provider: 'phone',
        display_name: null,
      },
      { onConflict: 'phone' },
    )
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .single()

  if (error || !data) {
    throw new Error('DB upsert user failed')
  }
  return data as DbUser
}

export async function updateUserGoogleInfo(input: {
  user_id: string
  google_sub: string
  email: string
  display_name: string | null
}): Promise<DbUser> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .update({
      google_sub: input.google_sub,
      email: input.email,
      display_name: input.display_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.user_id)
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .single()
  if (error || !data) {
    throw new Error('DB update user failed')
  }
  return data as DbUser
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('DB get user failed')
  return (data as DbUser) ?? null
}

export async function getUserByGoogleSub(google_sub: string): Promise<DbUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .eq('google_sub', google_sub)
    .maybeSingle()
  if (error) throw new Error('DB get user failed')
  return (data as DbUser) ?? null
}

export async function getUserByPhone(phone: string): Promise<DbUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('users')
    .select('id, google_sub, email, phone, auth_provider, display_name')
    .eq('phone', phone)
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

export async function getUserSecret(user_id: string, kind: string): Promise<DbUserSecret | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('user_secrets')
    .select('id, user_id, kind, meta, secret_encrypted')
    .eq('user_id', user_id)
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw new Error('DB get secret failed')
  return (data as DbUserSecret) ?? null
}

export async function upsertUserSecret(input: {
  user_id: string
  kind: string
  meta: Record<string, unknown>
  secret_encrypted: string
}): Promise<DbUserSecret> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('user_secrets')
    .upsert(
      {
        user_id: input.user_id,
        kind: input.kind,
        meta: input.meta,
        secret_encrypted: input.secret_encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,kind' },
    )
    .select('id, user_id, kind, meta, secret_encrypted')
    .single()

  if (error || !data) {
    throw new Error('DB upsert secret failed')
  }
  return data as DbUserSecret
}

export async function getAppSecret(kind: string): Promise<DbAppSecret | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('app_secrets')
    .select('id, kind, meta, secret_encrypted')
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw new Error('DB get app secret failed')
  return (data as DbAppSecret) ?? null
}

export async function upsertAppSecret(input: {
  kind: string
  meta: Record<string, unknown>
  secret_encrypted: string
}): Promise<DbAppSecret> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('app_secrets')
    .upsert(
      {
        kind: input.kind,
        meta: input.meta,
        secret_encrypted: input.secret_encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'kind' },
    )
    .select('id, kind, meta, secret_encrypted')
    .single()
  if (error || !data) {
    throw new Error('DB upsert app secret failed')
  }
  return data as DbAppSecret
}

export async function upsertVm(input: {
  id: string
  name: string
  provider?: string | null
  ip_address?: string | null
  status?: 'running' | 'stopped' | 'unknown'
  tags?: string[]
  notes?: string | null
}): Promise<DbVm> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('vms')
    .upsert(
      {
        id: input.id,
        name: input.name,
        provider: input.provider ?? null,
        ip_address: input.ip_address ?? null,
        status: input.status ?? 'unknown',
        tags: input.tags ?? [],
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id, name, provider, ip_address, status, tags, notes, created_at, updated_at')
    .single()
  if (error || !data) throw new Error('DB upsert vm failed')
  return data as DbVm
}

export async function getVmById(id: string): Promise<DbVm | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('vms')
    .select('id, name, provider, ip_address, status, tags, notes, created_at, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error('DB get vm failed')
  return (data as DbVm) ?? null
}

export async function upsertVmCredential(input: {
  vm_id: string
  kind: DbVmCredential['kind']
  meta: Record<string, unknown>
  secret_encrypted: string
}): Promise<DbVmCredential> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('vm_credentials')
    .upsert(
      {
        vm_id: input.vm_id,
        kind: input.kind,
        meta: input.meta,
        secret_encrypted: input.secret_encrypted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vm_id,kind' },
    )
    .select('id, vm_id, kind, meta, secret_encrypted, created_at, updated_at')
    .single()
  if (error || !data) throw new Error('DB upsert vm credential failed')
  return data as DbVmCredential
}

export async function getVmCredential(vm_id: string, kind: DbVmCredential['kind']): Promise<DbVmCredential | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('vm_credentials')
    .select('id, vm_id, kind, meta, secret_encrypted, created_at, updated_at')
    .eq('vm_id', vm_id)
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw new Error('DB get vm credential failed')
  return (data as DbVmCredential) ?? null
}

export async function listAdminUsers(): Promise<Array<Omit<DbAdminUser, 'password_hash'>>> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('admin_users')
    .select('id, email, role, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error('DB list admin users failed')
  return (data as Array<Omit<DbAdminUser, 'password_hash'>>) || []
}

export async function getAdminUserByEmail(email: string): Promise<DbAdminUser | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('admin_users')
    .select('id, email, role, password_hash, created_at, updated_at')
    .eq('email', email)
    .maybeSingle()
  if (error) throw new Error('DB get admin user failed')
  return (data as DbAdminUser) ?? null
}

export async function createAdminUser(input: { email: string; role: 'admin' | 'super_admin'; password_hash: string }): Promise<DbAdminUser> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('admin_users')
    .insert({
      email: input.email,
      role: input.role,
      password_hash: input.password_hash,
    })
    .select('id, email, role, password_hash, created_at, updated_at')
    .single()
  if (error || !data) throw new Error('DB create admin user failed')
  return data as DbAdminUser
}

export async function updateAdminUser(input: { id: string; role?: 'admin' | 'super_admin'; password_hash?: string }): Promise<DbAdminUser> {
  const sb = supabaseAdmin()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.role) patch.role = input.role
  if (input.password_hash) patch.password_hash = input.password_hash
  const { data, error } = await sb
    .from('admin_users')
    .update(patch)
    .eq('id', input.id)
    .select('id, email, role, password_hash, created_at, updated_at')
    .single()
  if (error || !data) throw new Error('DB update admin user failed')
  return data as DbAdminUser
}

export async function deleteAdminUser(id: string): Promise<void> {
  const sb = supabaseAdmin()
  const { error } = await sb.from('admin_users').delete().eq('id', id)
  if (error) throw new Error('DB delete admin user failed')
}

export async function insertPhoneOtp(input: {
  phone: string
  code_hash: string
  expires_at: string
}): Promise<void> {
  const sb = supabaseAdmin()
  const { error } = await sb.from('phone_otps').insert({
    phone: input.phone,
    code_hash: input.code_hash,
    expires_at: input.expires_at,
  })
  if (error) throw new Error('DB insert otp failed')
}

export async function getLatestPhoneOtp(phone: string): Promise<{
  id: string
  code_hash: string
  expires_at: string
  attempts: number
} | null> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('phone_otps')
    .select('id, code_hash, expires_at, attempts')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error('DB get otp failed')
  return (data as { id: string; code_hash: string; expires_at: string; attempts: number }) ?? null
}

export async function incrementOtpAttempts(id: string): Promise<void> {
  const sb = supabaseAdmin()
  const { error } = await sb.rpc('increment_otp_attempts', { otp_id: id })
  if (error) throw new Error('DB increment otp failed')
}
