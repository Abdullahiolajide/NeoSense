-- ╔══════════════════════════════════════════════════════════════╗
-- ║              NeoSense — Supabase Database Schema            ║
-- ║  Run this SQL in your Supabase SQL Editor to set up tables  ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ─── Enable UUID extension ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'health_worker')),
  institution TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─── Tests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  overall_risk TEXT DEFAULT 'pending' CHECK (overall_risk IN ('low', 'moderate', 'high', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tests"
  ON tests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tests"
  ON tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tests"
  ON tests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tests"
  ON tests FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Analyses ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('jaundice', 'cry')),
  file_url TEXT,
  raw_result JSONB,
  score FLOAT,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = analyses.test_id AND tests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = analyses.test_id AND tests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = analyses.test_id AND tests.user_id = auth.uid()
    )
  );

-- ─── Vitals ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  test_id UUID REFERENCES tests(id) ON DELETE CASCADE NOT NULL,
  temperature FLOAT,
  feeding_status TEXT CHECK (feeding_status IN ('Normal', 'Poor', 'Not feeding')),
  activity_level TEXT CHECK (activity_level IN ('Active', 'Weak', 'Unresponsive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own vitals"
  ON vitals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = vitals.test_id AND tests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own vitals"
  ON vitals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = vitals.test_id AND tests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own vitals"
  ON vitals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = vitals.test_id AND tests.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own vitals"
  ON vitals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tests WHERE tests.id = vitals.test_id AND tests.user_id = auth.uid()
    )
  );

-- ─── Chat Messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  test_id UUID REFERENCES tests(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Storage Buckets ────────────────────────────────────────────
-- Create these buckets in Supabase Dashboard > Storage:
-- 1. test-images (public)
-- 2. test-audio (public)

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('test-images', 'test-images', true),
  ('test-audio', 'test-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload test images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'test-images');

CREATE POLICY "Anyone can view test images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'test-images');

CREATE POLICY "Authenticated users can upload test audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'test-audio');

CREATE POLICY "Anyone can view test audio"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'test-audio');

-- ─── Indexes for performance ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tests_user_id ON tests(user_id);
CREATE INDEX IF NOT EXISTS idx_tests_created_at ON tests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_test_id ON analyses(test_id);
CREATE INDEX IF NOT EXISTS idx_vitals_test_id ON vitals(test_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
