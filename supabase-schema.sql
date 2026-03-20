-- ============================================================
-- UGC-NET Engine — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Papers table (each paper = one exam set)
CREATE TABLE IF NOT EXISTS papers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  year        INTEGER,
  paper_no    INTEGER DEFAULT 1,   -- Paper I / II / III
  questions   JSONB NOT NULL DEFAULT '[]',
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  is_active   BOOLEAN DEFAULT TRUE
);

-- Profiles table (to tag admin role)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) PRIMARY KEY,
  email       TEXT,
  role        TEXT DEFAULT 'viewer',  -- 'admin' | 'viewer'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS Policies
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read active papers
CREATE POLICY "Public can read active papers"
  ON papers FOR SELECT
  USING (is_active = TRUE);

-- Only admins can insert/update/delete papers
CREATE POLICY "Admins can manage papers"
  ON papers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- To promote a user to admin, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'you@example.com';
-- ============================================================
