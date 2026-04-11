CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected','disconnected','error')),
  scopes JSONB NOT NULL DEFAULT '{}'::jsonb,
  refresh_token_encrypted TEXT NOT NULL,
  last_token_refresh_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_connections_user_id ON public.google_connections(user_id);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users, public.google_connections, public.api_keys TO anon;
GRANT ALL PRIVILEGES ON public.users, public.google_connections, public.api_keys TO authenticated;
