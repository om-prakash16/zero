-- ========================================================================
-- 006_superadmin_platform_control.sql
-- CROSSWIRE Super Admin Platform Control, RBAC, Moderation, Settings & Audits
-- ========================================================================

-- 1. Create Profiles Table with strict Role & Status constraints
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'room_creator', 'moderator', 'admin', 'superadmin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);
CREATE INDEX IF NOT EXISTS profiles_status_idx ON public.profiles (status);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- 2. Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Seed Default Platform Settings
INSERT INTO public.platform_settings (key, value, description)
VALUES 
  ('default_room_capacity', '2'::jsonb, 'Default maximum capacity for newly created rooms'),
  ('max_permitted_capacity', '16'::jsonb, 'Maximum capacity boundary allowed across the platform'),
  ('default_admission_mode', '"approval_required"'::jsonb, 'Default admission mode: approval_required or auto_approve'),
  ('translation_model', '"gemini-2.5-flash"'::jsonb, 'Primary AI model used for translation'),
  ('maintenance_mode', 'false'::jsonb, 'Whether maintenance mode is active for non-admins'),
  ('auto_moderation_enabled', 'true'::jsonb, 'Whether automated safety filters are enabled')
ON CONFLICT (key) DO NOTHING;

-- 3. Moderation Reports Table
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('room', 'user', 'message')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mod_reports_status_idx ON public.moderation_reports (status);
CREATE INDEX IF NOT EXISTS mod_reports_target_idx ON public.moderation_reports (target_type, target_id);

-- 4. Immutable Administrative Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON public.admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.admin_audit_logs (action);

-- 5. Helper Functions & RBAC Checks
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT role, status INTO v_role, v_status FROM public.profiles WHERE id = user_id;
  RETURN (v_role = 'superadmin' AND v_status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_or_superadmin(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT role, status INTO v_role, v_status FROM public.profiles WHERE id = user_id;
  RETURN (v_role IN ('superadmin', 'admin') AND v_status = 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Strict Trigger: Prevent Non-Superadmin Profile Role / Status Escalation
CREATE OR REPLACE FUNCTION public.protect_profile_role_and_last_superadmin()
RETURNS TRIGGER AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
  v_active_superadmin_count INTEGER;
BEGIN
  -- If role or status is changing:
  IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    -- If triggered by an interactive auth caller (not a background system trigger):
    IF v_caller IS NOT NULL THEN
      SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller;
      IF v_caller_role IS DISTINCT FROM 'superadmin' THEN
        RAISE EXCEPTION 'Unauthorized: Only active superadmins can modify user roles or status.';
      END IF;
    END IF;

    -- Protect the LAST active superadmin from demotion or suspension/ban
    IF OLD.role = 'superadmin' AND (NEW.role != 'superadmin' OR NEW.status != 'active') THEN
      SELECT COUNT(*) INTO v_active_superadmin_count 
      FROM public.profiles 
      WHERE role = 'superadmin' AND status = 'active' AND id != OLD.id;
      
      IF v_active_superadmin_count < 1 THEN
        RAISE EXCEPTION 'Action rejected: Cannot demote or suspend the last active superadmin on the platform.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_roles ON public.profiles;
CREATE TRIGGER trg_protect_profile_roles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_and_last_superadmin();

-- 7. Trigger: Auto-sync new auth.users into profiles with secure bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT := LOWER(COALESCE(NEW.email, ''));
  v_role TEXT := 'user';
BEGIN
  -- Explicitly authorized bootstrap superadmin
  IF v_email = 'prakash.om.global@gmail.com' THEN
    v_role := 'superadmin';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), 'User'),
    v_role,
    'active',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN v_email = 'prakash.om.global@gmail.com' THEN 'superadmin'
      ELSE public.profiles.role
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Seed existing auth.users into public.profiles
INSERT INTO public.profiles (id, email, display_name, role, status, created_at, updated_at)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'User'),
  CASE 
    WHEN LOWER(email) = 'prakash.om.global@gmail.com' THEN 'superadmin'
    ELSE 'user'
  END,
  'active',
  created_at,
  NOW()
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET role = CASE 
  WHEN LOWER(public.profiles.email) = 'prakash.om.global@gmail.com' THEN 'superadmin'
  ELSE public.profiles.role
END;

-- 8. Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Public profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own display name and avatar" ON public.profiles;
CREATE POLICY "Users can update own display name and avatar"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Platform Settings Policies: Everyone can read non-sensitive settings, only superadmins can modify
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only superadmins can modify settings" ON public.platform_settings;
CREATE POLICY "Only superadmins can modify settings"
  ON public.platform_settings FOR ALL
  USING (public.is_superadmin(auth.uid()));

-- Moderation Reports Policies
DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.moderation_reports;
CREATE POLICY "Authenticated users can submit reports"
  ON public.moderation_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can view and manage reports" ON public.moderation_reports;
CREATE POLICY "Admins can view and manage reports"
  ON public.moderation_reports FOR ALL
  USING (public.is_admin_or_superadmin(auth.uid()));

-- Audit Logs Policies: Read-only for superadmins, immutable
DROP POLICY IF EXISTS "Only superadmins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Only superadmins can view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Superadmins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_superadmin(auth.uid()));

-- Audit logs cannot be updated or deleted by anyone
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. Updates and deletions are forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.admin_audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
  BEFORE UPDATE OR DELETE ON public.admin_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();
