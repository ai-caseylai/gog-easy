CREATE TABLE IF NOT EXISTS public.vms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('running','stopped','unknown')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vms_name ON public.vms (name);
CREATE INDEX IF NOT EXISTS idx_vms_status ON public.vms (status);

CREATE TABLE IF NOT EXISTS public.inventories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventories_name ON public.inventories (name);

CREATE TABLE IF NOT EXISTS public.inventory_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL,
  hostname TEXT NOT NULL,
  ansible_host TEXT,
  vm_id UUID,
  vars JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_hosts_inventory_id_fkey
    FOREIGN KEY (inventory_id) REFERENCES public.inventories(id) ON DELETE CASCADE,
  CONSTRAINT inventory_hosts_vm_id_fkey
    FOREIGN KEY (vm_id) REFERENCES public.vms(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_hosts_inventory_id ON public.inventory_hosts (inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_hosts_hostname ON public.inventory_hosts (hostname);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  target_type TEXT NOT NULL CHECK (target_type IN ('vm','inventory','inventory_host','vm_credential')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_type, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.vm_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vm_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ssh_password','ssh_private_key','vnc_password')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vm_credentials_vm_id_fkey
    FOREIGN KEY (vm_id) REFERENCES public.vms(id) ON DELETE CASCADE,
  CONSTRAINT vm_credentials_unique_vm_kind UNIQUE (vm_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_vm_credentials_vm_id ON public.vm_credentials (vm_id);

ALTER TABLE public.vms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_read_vms ON public.vms;
DROP POLICY IF EXISTS admin_write_vms ON public.vms;
DROP POLICY IF EXISTS admin_read_inventories ON public.inventories;
DROP POLICY IF EXISTS admin_write_inventories ON public.inventories;
DROP POLICY IF EXISTS admin_read_inventory_hosts ON public.inventory_hosts;
DROP POLICY IF EXISTS admin_write_inventory_hosts ON public.inventory_hosts;
DROP POLICY IF EXISTS admin_read_audit_logs ON public.audit_logs;
DROP POLICY IF EXISTS admin_insert_vm_credentials ON public.vm_credentials;
DROP POLICY IF EXISTS admin_update_vm_credentials ON public.vm_credentials;

CREATE POLICY admin_read_vms ON public.vms
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_write_vms ON public.vms
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_read_inventories ON public.inventories
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_write_inventories ON public.inventories
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_read_inventory_hosts ON public.inventory_hosts
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_write_inventory_hosts ON public.inventory_hosts
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_read_audit_logs ON public.audit_logs
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_insert_vm_credentials ON public.vm_credentials
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

CREATE POLICY admin_update_vm_credentials ON public.vm_credentials
  FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'))
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','super_admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_hosts TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT INSERT, UPDATE ON public.vm_credentials TO authenticated;

