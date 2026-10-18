-- =============================================
-- 004_create_profiles_and_roles.sql
-- CROSSWIRE User Profiles, Roles, and Registration
-- =============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  age INTEGER,
  gender TEXT,
  role TEXT DEFAULT 'user', -- 'super_admin', 'admin', 'user'
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles (username);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 1. SELECT: Anyone can view profiles (for displaying speaker names in rooms)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

-- 2. INSERT: Authenticated users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. UPDATE: Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Function to handle new user profile creation & role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN LOWER(NEW.email) = 'prakash.om.global@gmail.com' THEN 'super_admin'
      ELSE 'user'
    END
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = CASE 
      WHEN LOWER(EXCLUDED.email) = 'prakash.om.global@gmail.com' THEN 'super_admin'
      ELSE public.profiles.role
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Seed existing users into profiles and assign super_admin
INSERT INTO public.profiles (id, email, display_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  CASE 
    WHEN LOWER(email) = 'prakash.om.global@gmail.com' THEN 'super_admin'
    ELSE 'user'
  END
FROM auth.users
WHERE email IS NOT NULL AND email != ''
ON CONFLICT (id) DO UPDATE
SET role = CASE 
  WHEN LOWER(EXCLUDED.email) = 'prakash.om.global@gmail.com' THEN 'super_admin'
  ELSE public.profiles.role
END;
