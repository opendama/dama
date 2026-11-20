-- dama initial schema (FMJD tournament platform)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  rating INT NOT NULL DEFAULT 1200,
  xp INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  avatar_thumb_url TEXT,
  avatar_full_url TEXT,
  avatar_public_id TEXT,
  country_code TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (key, enabled, payload) VALUES
  ('vs_ai_practice_mode', TRUE, '{"depths":[2,4,6,8,10]}'::jsonb),
  ('global_otp_verification', FALSE, '{}'::jsonb),
  ('ethiopian_payment_mode', TRUE, '{"mode":"chapa"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  entry_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  entry_fee_currency TEXT NOT NULL,
  prize_pool JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES tournaments(id),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  entry_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'pvp',
  status TEXT NOT NULL DEFAULT 'pending',
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  board_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_search_depth INT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  currency TEXT NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, currency)
);

CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  account_name TEXT,
  account_number TEXT,
  mobile_code TEXT,
  currency TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  encrypted_secrets BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'email',
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geo_ip_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  ip TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  source TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_geo_ip_user ON geo_ip_records(user_id, created_at DESC);

-- Global default is USD. Ethiopia domestic flows use ETB from this row (admin-editable).
INSERT INTO platform_settings (key, value) VALUES
  ('currency', '{"global":"USD","ethiopia":"ETB","supported":["USD","ETB"]}'::jsonb),
  ('geo_payment', '{"ethiopia_country":"ET"}'::jsonb),
  ('avatar_moderation', '{"provider":"cloudinary_aws_rek","enabled":true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  reference TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL DEFAULT 'wallet_topup',
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL,
  provider TEXT NOT NULL,
  country_code TEXT,
  tx_ref TEXT UNIQUE NOT NULL,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_tx_ref ON payment_intents(tx_ref);

CREATE TABLE IF NOT EXISTS youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  label TEXT NOT NULL,
  client_id_enc BYTEA,
  client_secret_enc BYTEA,
  refresh_token_enc BYTEA,
  api_key_enc BYTEA,
  daily_quota_limit INT NOT NULL DEFAULT 6,
  uploads_today INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_error TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  daily_spend_cap NUMERIC(14,2),
  geo_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  creative_type TEXT NOT NULL DEFAULT 'image',
  creative_url TEXT,
  youtube_video_id TEXT,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  video_completions BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS draws INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_fee_charged NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, user_id)
);

-- No silent USD column defaults. Currency comes from platform_settings + geo.
ALTER TABLE tournaments ALTER COLUMN entry_fee_currency DROP DEFAULT;
ALTER TABLE wallets ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE payment_accounts ALTER COLUMN currency DROP DEFAULT;
ALTER TABLE tournament_entries ALTER COLUMN currency DROP DEFAULT;

DO $$ BEGIN
  -- migrate wallets unique constraint from user_id-only to (user_id, currency) if needed
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_key'
  ) THEN
    ALTER TABLE wallets DROP CONSTRAINT wallets_user_id_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_currency_key'
  ) THEN
    BEGIN
      ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_currency_key UNIQUE (user_id, currency);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_publisher ON ad_campaigns(publisher_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_user ON tournament_entries(user_id);

CREATE TABLE IF NOT EXISTS match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'pvp',
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  winner_id UUID REFERENCES users(id),
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  move_count INT NOT NULL DEFAULT 0,
  ai_search_depth INT,
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_match_history_players ON match_history(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_match_history_finished ON match_history(finished_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_moderation_status TEXT NOT NULL DEFAULT 'none';

CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  user_agent TEXT,
  platform TEXT,
  ip_hint TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user ON device_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_seen ON device_fingerprints(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS youtube_upload_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  publisher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  local_path TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  video_id TEXT,
  channel_label TEXT,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Layer 7: RLS for Supabase authenticated clients (auth.uid()).
-- Go API uses the database service role, which bypasses RLS by design.
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS wallets_owner_select ON wallets;
  DROP POLICY IF EXISTS receipts_owner_select ON payment_receipts;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_select_own') THEN
    CREATE POLICY wallets_select_own ON wallets
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'wallets_update_own') THEN
    CREATE POLICY wallets_update_own ON wallets
      FOR UPDATE TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'receipts_select_own') THEN
    CREATE POLICY receipts_select_own ON payment_receipts
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'receipts_insert_own') THEN
    CREATE POLICY receipts_insert_own ON payment_receipts
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'intents_select_own') THEN
    CREATE POLICY intents_select_own ON payment_intents
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'youtube_admin_only') THEN
    CREATE POLICY youtube_admin_only ON youtube_channels
      FOR ALL TO authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'audit_admin_only') THEN
    CREATE POLICY audit_admin_only ON audit_log
      FOR SELECT TO authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'fingerprints_select_own') THEN
    CREATE POLICY fingerprints_select_own ON device_fingerprints
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ads_publisher_select') THEN
    CREATE POLICY ads_publisher_select ON ad_campaigns
      FOR SELECT TO authenticated
      USING (auth.uid() = publisher_id OR status = 'active');
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_function THEN NULL;
  WHEN invalid_schema_name THEN NULL;
END $$;
