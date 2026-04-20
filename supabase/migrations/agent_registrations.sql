CREATE TABLE IF NOT EXISTS public.agent_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  domain TEXT NOT NULL,
  qr_text TEXT,
  qr_updated_at TIMESTAMPTZ,
  llm_primary JSONB NOT NULL DEFAULT '{}'::jsonb,
  llm_secondary JSONB NOT NULL DEFAULT '{}'::jsonb,
  ssh_host TEXT,
  ssh_port INT NOT NULL DEFAULT 22,
  ssh_user TEXT NOT NULL DEFAULT 'root',
  ssh_password_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(phone, domain)
);

CREATE INDEX IF NOT EXISTS idx_agent_registrations_phone ON public.agent_registrations (phone);
CREATE INDEX IF NOT EXISTS idx_agent_registrations_domain ON public.agent_registrations (domain);
CREATE INDEX IF NOT EXISTS idx_agent_registrations_status ON public.agent_registrations (status);

ALTER TABLE public.agent_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_all_agent_registrations ON public.agent_registrations
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY service_role_agent_registrations ON public.agent_registrations
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_registrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_registrations TO service_role;
