ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'google';

ALTER TABLE public.users
  ALTER COLUMN google_sub DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON public.users(phone);

UPDATE public.users
SET auth_provider = 'google'
WHERE auth_provider IS NULL OR auth_provider = '';

