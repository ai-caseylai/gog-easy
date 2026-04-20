CREATE TABLE IF NOT EXISTS public.user_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_secrets_user_kind ON public.user_secrets(user_id, kind);
CREATE INDEX IF NOT EXISTS idx_user_secrets_user_id ON public.user_secrets(user_id);

ALTER TABLE public.user_secrets
  DROP CONSTRAINT IF EXISTS user_secrets_user_id_fkey;

ALTER TABLE public.user_secrets
  ADD CONSTRAINT user_secrets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

